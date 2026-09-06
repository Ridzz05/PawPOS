package customers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMemoryCustomerPetFlow(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	cust, err := repo.CreateCustomer(ctx, UpsertCustomerRequest{Name: "  Andi Wijaya ", Phone: "08123456789"})
	if err != nil {
		t.Fatalf("CreateCustomer = %v", err)
	}
	if cust.Name != "Andi Wijaya" || !cust.IsActive {
		t.Fatalf("unexpected customer = %#v", cust)
	}

	pet, err := repo.CreatePet(ctx, UpsertPetRequest{
		CustomerID: cust.ID,
		Name:       "Mochi",
		Species:    "Kucing",
		Breed:      "Persia",
		WeightKg:   4.5,
		Allergies:  "Ikan",
	})
	if err != nil {
		t.Fatalf("CreatePet = %v", err)
	}
	if pet.CustomerName != "Andi Wijaya" {
		t.Fatalf("pet missing owner name = %#v", pet)
	}

	if _, err := repo.CreatePet(ctx, UpsertPetRequest{CustomerID: "ghost", Name: "X"}); err != ErrCustomerNotFound {
		t.Fatalf("orphan pet err = %v", err)
	}

	list, err := repo.ListCustomers(ctx, "andi")
	if err != nil || len(list) != 1 {
		t.Fatalf("search customers = %+v, %v", list, err)
	}
	if _, err := repo.ListCustomers(ctx, "zzz"); err != nil {
		t.Fatalf("empty search = %v", err)
	}

	pets, err := repo.ListPets(ctx, cust.ID)
	if err != nil || len(pets) != 1 {
		t.Fatalf("list pets = %+v, %v", pets, err)
	}

	updated, err := repo.UpdateCustomer(ctx, cust.ID, UpsertCustomerRequest{Name: "Andi W.", Phone: "0800"})
	if err != nil || updated.Name != "Andi W." {
		t.Fatalf("update customer = %#v, %v", updated, err)
	}
	if _, err := repo.GetCustomerByID(ctx, "nope"); err != ErrCustomerNotFound {
		t.Fatalf("missing customer err = %v", err)
	}

	weight := 5.0
	updatedPet, err := repo.UpdatePet(ctx, pet.ID, UpsertPetRequest{CustomerID: cust.ID, Name: "Mochi Jr", WeightKg: weight})
	if err != nil || updatedPet.Name != "Mochi Jr" || updatedPet.WeightKg != 5 {
		t.Fatalf("update pet = %#v, %v", updatedPet, err)
	}
	if _, err := repo.GetPetByID(ctx, "nope"); err != ErrPetNotFound {
		t.Fatalf("missing pet err = %v", err)
	}
}

func doCustomerRequest(t *testing.T, handler http.HandlerFunc, method, target, body string) (int, map[string]any) {
	t.Helper()
	req := httptest.NewRequest(method, target, bytes.NewReader([]byte(body)))
	rec := httptest.NewRecorder()
	handler(rec, req)
	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return rec.Code, payload
}

func TestHandlerCustomerValidation(t *testing.T) {
	h := NewHandler(NewMemoryRepository())

	status, _ := doCustomerRequest(t, h.CreateCustomer, http.MethodPost, "/api/v1/customers", `{"name":""}`)
	if status != http.StatusBadRequest {
		t.Fatalf("empty name status = %d", status)
	}

	status, payload := doCustomerRequest(t, h.CreateCustomer, http.MethodPost, "/api/v1/customers", `{"name":"Budi","phone":"0811"}`)
	if status != http.StatusCreated {
		t.Fatalf("create status = %d (%v)", status, payload)
	}
	custID := payload["data"].(map[string]any)["id"].(string)

	status, _ = doCustomerRequest(t, h.GetCustomer, http.MethodGet, "/api/v1/customers/"+custID, "")
	// Note: chi URL params are empty outside router; expect 404 here, covered in router test.
	if status != http.StatusNotFound {
		t.Fatalf("direct get status = %d", status)
	}

	status, _ = doCustomerRequest(t, h.CreatePet, http.MethodPost, "/api/v1/pets", `{"customer_id":"","name":"Kitty"}`)
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("pet without owner status = %d", status)
	}

	status, _ = doCustomerRequest(t, h.CreatePet, http.MethodPost, "/api/v1/pets", `{"customer_id":"ghost","name":"Kitty"}`)
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("orphan pet status = %d", status)
	}

	status, payload = doCustomerRequest(t, h.ListPets, http.MethodGet, "/api/v1/pets", "")
	if status != http.StatusOK {
		t.Fatalf("list pets status = %d", status)
	}
	if !strings.Contains(string(mustJSON(payload)), "request_id") {
		t.Fatalf("missing request_id in %v", payload)
	}
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
