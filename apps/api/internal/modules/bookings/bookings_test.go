package bookings

import (
	"context"
	"testing"

	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/customers"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/inventory"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/orders"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/services"
)

func testRepos() (Repository, *services.MemoryRepository, *customers.MemoryRepository, *orders.MemoryRepository) {
	svcRepo := services.NewMemoryRepository()
	custRepo := customers.NewMemoryRepository()
	orderRepo := orders.NewMemoryRepository(inventory.NewMemoryRepository())
	return NewMemoryRepository(), svcRepo, custRepo, orderRepo
}

func seedBookingRefs(t *testing.T, svcRepo *services.MemoryRepository, custRepo *customers.MemoryRepository) (customerID, petID, serviceID string) {
	t.Helper()
	ctx := context.Background()
	cust, err := custRepo.CreateCustomer(ctx, customers.UpsertCustomerRequest{Name: "Andi", Phone: "0811"})
	if err != nil {
		t.Fatalf("seed customer: %v", err)
	}
	pet, err := custRepo.CreatePet(ctx, customers.UpsertPetRequest{CustomerID: cust.ID, Name: "Mochi"})
	if err != nil {
		t.Fatalf("seed pet: %v", err)
	}
	svc, err := svcRepo.CreateService(ctx, services.UpsertServiceRequest{Name: "Grooming", Category: "grooming", PriceIDR: 50000})
	if err != nil {
		t.Fatalf("seed service: %v", err)
	}
	return cust.ID, pet.ID, svc.ID
}

func TestMemoryStatusMachine(t *testing.T) {
	repo, _, _, _ := testRepos()
	ctx := context.Background()

	b, err := repo.Create(ctx, Booking{CustomerID: "c", PetID: "p", LocationID: "loc-main"})
	if err != nil {
		t.Fatalf("create = %v", err)
	}
	if b.Status != StatusAntre {
		t.Fatalf("initial status = %s", b.Status)
	}

	updated, err := repo.UpdateStatus(ctx, b.ID, StatusProses, "")
	if err != nil || updated.Status != StatusProses {
		t.Fatalf("antre->proses = %#v, %v", updated, err)
	}
	if _, err := repo.UpdateStatus(ctx, b.ID, StatusAntre, ""); err != ErrInvalidStatus {
		t.Fatalf("backward err = %v", err)
	}
	if _, err := repo.UpdateStatus(ctx, b.ID, StatusSelesai, ""); err != ErrInvalidStatus {
		t.Fatalf("direct selesai err = %v", err)
	}

	done, err := repo.MarkCompleted(ctx, b.ID, "ord-1")
	if err != nil || done.Status != StatusSelesai || done.OrderID == nil || *done.OrderID != "ord-1" {
		t.Fatalf("mark completed = %#v, %v", done, err)
	}
	if _, err := repo.MarkCompleted(ctx, b.ID, "ord-1"); err != ErrAlreadyClosed {
		t.Fatalf("double complete err = %v", err)
	}
	if _, err := repo.UpdateStatus(ctx, b.ID, StatusBatal, ""); err != ErrAlreadyClosed {
		t.Fatalf("closed update err = %v", err)
	}
	if _, err := repo.GetByID(ctx, "ghost"); err != ErrBookingNotFound {
		t.Fatalf("missing err = %v", err)
	}

	today := b.ScheduledAt.UTC().Format("2006-01-02")
	list, err := repo.List(ctx, BookingFilter{Date: today})
	if err != nil || len(list) != 1 {
		t.Fatalf("date filter = %+v, %v", list, err)
	}
	list, _ = repo.List(ctx, BookingFilter{Status: StatusAntre})
	if len(list) != 0 {
		t.Fatalf("status filter = %+v", list)
	}
}

func TestJasaOrderSkipsStock(t *testing.T) {
	_, svcRepo, custRepo, orderRepo := testRepos()
	ctx := context.Background()
	_, _, svcID := seedBookingRefs(t, svcRepo, custRepo)

	order, err := orderRepo.CreateOrder(ctx, orders.CreateOrderRequest{
		LocationID:    "loc-main",
		PaymentMethod: "cash",
		PaidAmountIDR: 50000,
		Items: []orders.CreateOrderItemRequest{{
			ProductName: "Grooming", SKU: "JASA-GROOMING", UnitPriceIDR: 50000,
			Quantity: 1, ItemKind: orders.ItemKindJasa, ServiceID: &svcID,
		}},
	})
	if err != nil {
		t.Fatalf("jasa order = %v", err)
	}
	if len(order.Items) != 1 || order.Items[0].ItemKind != orders.ItemKindJasa {
		t.Fatalf("order items = %+v", order.Items)
	}
	if order.TotalIDR != 50000 || order.ChangeAmountIDR != 0 {
		t.Fatalf("order totals = %+v", order.Order)
	}
}
