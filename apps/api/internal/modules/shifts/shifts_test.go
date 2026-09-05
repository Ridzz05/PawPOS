package shifts

import (
	"context"
	"testing"

	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

func TestOpenShift_Success(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := tenantcontext.WithTenantID(context.Background(), "store-1")

	shift, err := repo.OpenShift(ctx, OpenShiftRequest{
		CashierName:     "Kasir Alpha",
		StartingCashIDR: 200000,
		Notes:           "Shift pagi outlet 1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if shift.Status != "open" {
		t.Errorf("expected status 'open', got %q", shift.Status)
	}
	if shift.CashierName != "Kasir Alpha" {
		t.Errorf("expected cashier 'Kasir Alpha', got %q", shift.CashierName)
	}
	if shift.StartingCashIDR != 200000 {
		t.Errorf("expected starting cash 200000, got %d", shift.StartingCashIDR)
	}
	if shift.ExpectedCashIDR != 200000 {
		t.Errorf("expected initial expected cash 200000, got %d", shift.ExpectedCashIDR)
	}

	// Current shift query
	cur, err := repo.GetCurrentShift(ctx)
	if err != nil {
		t.Fatalf("unexpected error fetching current shift: %v", err)
	}
	if cur == nil || cur.ID != shift.ID {
		t.Fatalf("expected current shift ID %s, got %v", shift.ID, cur)
	}
}

func TestOpenShift_Validation(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := tenantcontext.WithTenantID(context.Background(), "store-1")

	// Empty name
	_, err := repo.OpenShift(ctx, OpenShiftRequest{
		CashierName:     "   ",
		StartingCashIDR: 50000,
	})
	if err != ErrCashierNameRequired {
		t.Errorf("expected ErrCashierNameRequired, got %v", err)
	}

	// Negative starting cash
	_, err = repo.OpenShift(ctx, OpenShiftRequest{
		CashierName:     "Kasir",
		StartingCashIDR: -1000,
	})
	if err != ErrInvalidStartingCash {
		t.Errorf("expected ErrInvalidStartingCash, got %v", err)
	}
}

func TestOpenShift_AlreadyOpen(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := tenantcontext.WithTenantID(context.Background(), "store-1")

	_, err := repo.OpenShift(ctx, OpenShiftRequest{
		CashierName:     "Kasir 1",
		StartingCashIDR: 100000,
	})
	if err != nil {
		t.Fatalf("unexpected error on first open: %v", err)
	}

	// Second open should fail
	_, err = repo.OpenShift(ctx, OpenShiftRequest{
		CashierName:     "Kasir 2",
		StartingCashIDR: 50000,
	})
	if err != ErrShiftAlreadyOpen {
		t.Errorf("expected ErrShiftAlreadyOpen, got %v", err)
	}
}

func TestCloseShift_Reconciliation(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := tenantcontext.WithTenantID(context.Background(), "store-1")

	shift, err := repo.OpenShift(ctx, OpenShiftRequest{
		CashierName:     "Kasir 1",
		StartingCashIDR: 100000,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Record transactions: 1 cash of 75.000, 1 QRIS of 50.000, 1 split of 40.000 (20k cash + 20k non-cash)
	_ = repo.RecordSale(ctx, "store-1", "cash", 75000, 75000, 0)
	_ = repo.RecordSale(ctx, "store-1", "qris", 50000, 0, 50000)
	_ = repo.RecordSale(ctx, "store-1", "split", 40000, 20000, 20000)

	// Close shift with actual cash 200.000 (Expected: 100.000 + 75.000 + 20.000 = 195.000 -> Difference: +5.000 surplus)
	closed, err := repo.CloseShift(ctx, shift.ID, CloseShiftRequest{
		ActualCashIDR: 200000,
		Notes:         "Kas fisik dihitung bersama supervisor",
	})
	if err != nil {
		t.Fatalf("unexpected error closing shift: %v", err)
	}

	if closed.Status != "closed" {
		t.Errorf("expected status 'closed', got %q", closed.Status)
	}
	if closed.StartingCashIDR != 100000 {
		t.Errorf("expected starting cash 100000, got %d", closed.StartingCashIDR)
	}
	if closed.TotalCashSalesIDR != 95000 {
		t.Errorf("expected cash sales 95000, got %d", closed.TotalCashSalesIDR)
	}
	if closed.TotalNonCashSalesIDR != 70000 {
		t.Errorf("expected non-cash sales 70000, got %d", closed.TotalNonCashSalesIDR)
	}
	if closed.ExpectedCashIDR != 195000 {
		t.Errorf("expected 195000, got %d", closed.ExpectedCashIDR)
	}
	if closed.CashDifferenceIDR != 5000 {
		t.Errorf("expected +5000, got %d", closed.CashDifferenceIDR)
	}
	if closed.TransactionCount != 3 {
		t.Errorf("expected 3 transactions, got %d", closed.TransactionCount)
	}
	if closed.CashDifferenceIDR != 5000 {
		t.Errorf("expected difference +5000, got %d", closed.CashDifferenceIDR)
	}
	if closed.ClosedAt == nil {
		t.Errorf("expected ClosedAt to be populated")
	}

	// After closing, current shift should be nil
	cur, err := repo.GetCurrentShift(ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cur != nil {
		t.Errorf("expected nil current shift after close, got %v", cur)
	}
}

func TestMultiTenantShiftIsolation(t *testing.T) {
	repo := NewMemoryRepository()
	ctxA := tenantcontext.WithTenantID(context.Background(), "merchant-alpha")
	ctxB := tenantcontext.WithTenantID(context.Background(), "merchant-beta")

	// Merchant Alpha opens a shift
	shiftA, err := repo.OpenShift(ctxA, OpenShiftRequest{
		CashierName:     "Alpha Staff",
		StartingCashIDR: 150000,
	})
	if err != nil {
		t.Fatalf("merchant alpha failed to open shift: %v", err)
	}

	// Merchant Beta must be able to open their own shift independently
	shiftB, err := repo.OpenShift(ctxB, OpenShiftRequest{
		CashierName:     "Beta Staff",
		StartingCashIDR: 300000,
	})
	if err != nil {
		t.Fatalf("merchant beta failed to open shift: %v", err)
	}

	// Verify isolation
	curA, _ := repo.GetCurrentShift(ctxA)
	if curA == nil || curA.ID != shiftA.ID {
		t.Fatalf("expected merchant A to see shift %s, got %v", shiftA.ID, curA)
	}

	curB, _ := repo.GetCurrentShift(ctxB)
	if curB == nil || curB.ID != shiftB.ID {
		t.Fatalf("expected merchant B to see shift %s, got %v", shiftB.ID, curB)
	}

	// Beta list must not include Alpha's shifts
	listB, _ := repo.ListShifts(ctxB, 10)
	if len(listB) != 1 || listB[0].ID != shiftB.ID {
		t.Fatalf("expected merchant B list to contain only shift B, got %v", listB)
	}
}
