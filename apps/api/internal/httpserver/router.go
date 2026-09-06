package httpserver

import (
	"database/sql"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/assistant"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/auth"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/bookings"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/customers"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/inventory"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/orders"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/products"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/promos"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/services"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/shifts"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/tenant"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/uploads"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/config"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/health"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/requestid"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

func NewRouter(log *slog.Logger, ready health.Check, db *sql.DB, configurations ...config.Config) http.Handler {
	var productRepo products.Repository
	var inventoryRepo inventory.Repository
	var orderRepo orders.Repository
	var tenantRepo tenant.Repository
	var shiftRepo shifts.Repository
	var authRepo auth.Repository
	var categoryRepo products.CategoryRepository
	var customerRepo customers.Repository
	var serviceRepo services.Repository
	var bookingRepo bookings.Repository
	var promoRepo promos.Repository
	if db != nil {
		productRepo = products.NewPostgresRepository(db)
		inventoryRepo = inventory.NewPostgresRepository(db)
		orderRepo = orders.NewPostgresRepository(db)
		tenantRepo = tenant.NewPostgresRepository(db)
		shiftRepo = shifts.NewPostgresRepository(db)
		authRepo = auth.NewPostgresRepository(db)
		categoryRepo = products.NewPostgresCategoryRepository(db)
		customerRepo = customers.NewPostgresRepository(db)
		serviceRepo = services.NewPostgresRepository(db)
		bookingRepo = bookings.NewPostgresRepository(db)
		promoRepo = promos.NewPostgresRepository(db)
	} else {
		productRepo = products.NewMemoryRepository()
		inventoryRepo = inventory.NewMemoryRepository()
		orderRepo = orders.NewMemoryRepository(inventoryRepo)
		tenantRepo = tenant.NewMemoryRepository()
		shiftRepo = shifts.NewMemoryRepository()
		authRepo = auth.NewMemoryRepository()
		categoryRepo = products.NewMemoryCategoryRepository()
		customerRepo = customers.NewMemoryRepository()
		serviceRepo = services.NewMemoryRepository()
		bookingRepo = bookings.NewMemoryRepository()
		promoRepo = promos.NewMemoryRepository()
	}
	return NewRouterWithAuthRepos(log, ready, productRepo, inventoryRepo, orderRepo, tenantRepo, shiftRepo, authRepo, categoryRepo, customerRepo, serviceRepo, bookingRepo, promoRepo, configurations...)
}

func NewRouterWithRepo(log *slog.Logger, ready health.Check, productRepo products.Repository, configurations ...config.Config) http.Handler {
	inv := inventory.NewMemoryRepository()
	return NewRouterWithAllRepos(log, ready, productRepo, inv, orders.NewMemoryRepository(inv), tenant.NewMemoryRepository(), shifts.NewMemoryRepository(), configurations...)
}

func NewRouterWithRepos(log *slog.Logger, ready health.Check, productRepo products.Repository, inventoryRepo inventory.Repository, configurations ...config.Config) http.Handler {
	return NewRouterWithAllRepos(log, ready, productRepo, inventoryRepo, orders.NewMemoryRepository(inventoryRepo), tenant.NewMemoryRepository(), shifts.NewMemoryRepository(), configurations...)
}

func NewRouterWithAllRepos(log *slog.Logger, ready health.Check, productRepo products.Repository, inventoryRepo inventory.Repository, orderRepo orders.Repository, tenantRepo tenant.Repository, shiftRepo shifts.Repository, configurations ...config.Config) http.Handler {
	return NewRouterWithAuthRepos(log, ready, productRepo, inventoryRepo, orderRepo, tenantRepo, shiftRepo, auth.NewMemoryRepository(), products.NewMemoryCategoryRepository(), customers.NewMemoryRepository(), services.NewMemoryRepository(), bookings.NewMemoryRepository(), promos.NewMemoryRepository(), configurations...)
}

func NewRouterWithAuthRepos(log *slog.Logger, ready health.Check, productRepo products.Repository, inventoryRepo inventory.Repository, orderRepo orders.Repository, tenantRepo tenant.Repository, shiftRepo shifts.Repository, authRepo auth.Repository, categoryRepo products.CategoryRepository, customerRepo customers.Repository, serviceRepo services.Repository, bookingRepo bookings.Repository, promoRepo promos.Repository, configurations ...config.Config) http.Handler {
	cfg := config.Load()
	if len(configurations) > 0 {
		cfg = configurations[0]
	}
	if promoRepo == nil {
		promoRepo = promos.NewMemoryRepository()
	}
	if memOrderRepo, ok := orderRepo.(*orders.MemoryRepository); ok {
		memOrderRepo.SetPromoRedeemer(promoRepo)
	}
	router := chi.NewRouter()
	router.Use(requestid.Middleware)
	router.Use(tenantMiddleware)
	router.Use(middleware.Recoverer)
	router.Use(cors)
	router.NotFound(func(w http.ResponseWriter, r *http.Request) {
		if cfg.WebDir != "" && !strings.HasPrefix(r.URL.Path, "/api") && !strings.HasPrefix(r.URL.Path, "/health") && !strings.HasPrefix(r.URL.Path, "/uploads") {
			cleanPath := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
			targetFile := filepath.Join(cfg.WebDir, cleanPath)
			if fi, err := os.Stat(targetFile); err == nil && !fi.IsDir() {
				http.ServeFile(w, r, targetFile)
				return
			}
			indexPath := filepath.Join(cfg.WebDir, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				http.ServeFile(w, r, indexPath)
				return
			}
		}
		envelope.WriteError(w, r, http.StatusNotFound, "NOT_FOUND", "The requested route does not exist.", nil)
	})
	router.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		envelope.WriteError(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "The request method is not supported.", nil)
	})

	healthHandler := health.NewHandler(ready)
	assistantHandler := assistant.NewHandler(cfg, assistant.NewGroqTranscriber(cfg.GroqAPIKey, cfg.STTModel))
	if productRepo == nil {
		productRepo = products.NewMemoryRepository()
	}
	if inventoryRepo == nil {
		inventoryRepo = inventory.NewMemoryRepository()
	}
	if orderRepo == nil {
		orderRepo = orders.NewMemoryRepository(inventoryRepo)
	}
	if tenantRepo == nil {
		tenantRepo = tenant.NewMemoryRepository()
	}
	if shiftRepo == nil {
		shiftRepo = shifts.NewMemoryRepository()
	}
	if authRepo == nil {
		authRepo = auth.NewMemoryRepository()
	}
	if categoryRepo == nil {
		categoryRepo = products.NewMemoryCategoryRepository()
	}
	if customerRepo == nil {
		customerRepo = customers.NewMemoryRepository()
	}
	if serviceRepo == nil {
		serviceRepo = services.NewMemoryRepository()
	}
	if bookingRepo == nil {
		bookingRepo = bookings.NewMemoryRepository()
	}

	// Link order repo with shift repo to record cashier sales automatically
	if sr, ok := orderRepo.(interface{ SetSaleRecorder(orders.SaleRecorder) }); ok {
		sr.SetSaleRecorder(shiftRepo)
	}

	assistantHandler.SetContextProvider(&assistant.DefaultStoreContextProvider{
		Products: productRepo,
		Stocks:   inventoryRepo,
		Shifts:   shiftRepo,
		Orders:   orderRepo,
		Tenants:  tenantRepo,
	})

	productHandler := products.NewHandler(productRepo)
	inventoryHandler := inventory.NewHandler(inventoryRepo)
	orderHandler := orders.NewHandler(orderRepo)
	tenantHandler := tenant.NewHandler(tenantRepo)
	shiftHandler := shifts.NewHandler(shiftRepo)
	authHandler := auth.NewHandler(authRepo, time.Duration(cfg.SessionTTLHours)*time.Hour)
	categoryHandler := products.NewCategoryHandler(categoryRepo)
	customerHandler := customers.NewHandler(customerRepo)
	serviceHandler := services.NewHandler(serviceRepo)
	bookingHandler := bookings.NewHandler(bookingRepo, orderRepo, serviceRepo, customerRepo)
	promoHandler := promos.NewHandler(promoRepo)
	uploadHandler := uploads.NewHandler("./uploads")

	router.Get("/health/live", healthHandler.Live)
	router.Get("/health/ready", healthHandler.Ready)
	if cfg.WebDir != "" {
		router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			indexPath := filepath.Join(cfg.WebDir, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				http.ServeFile(w, r, indexPath)
				return
			}
			envelope.Write(w, r, http.StatusOK, map[string]string{"service": "pawpos", "status": "ok"})
		})
	}
	router.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))
	router.Route("/api/v1", func(r chi.Router) {
		r.Get("/ping", func(w http.ResponseWriter, req *http.Request) {
			envelope.Write(w, req, http.StatusOK, map[string]string{"service": "api", "status": "ok"})
		})
		r.Post("/assistant/transcriptions", assistantHandler.Transcribe)
		r.Post("/assistant/chat", assistantHandler.Chat)
		r.Post("/assistant/tts", assistantHandler.TextToSpeech)
		r.Post("/uploads", uploadHandler.UploadImage)
		r.Route("/tenants", func(tr chi.Router) {
			tr.Post("/register", tenantHandler.Register)
			tr.Get("/", tenantHandler.List)
			tr.Get("/{id}", tenantHandler.GetByID)
		})
		r.Route("/auth", func(ar chi.Router) {
			ar.Post("/login", authHandler.Login)
			ar.Post("/pin", authHandler.PinLogin)
			ar.Post("/logout", authHandler.Logout)
			ar.Get("/me", authHandler.Me)
		})
		r.Get("/products", productHandler.List)
		r.Post("/products", productHandler.Create)
		r.Put("/products/{id}", productHandler.Update)
		r.Delete("/products/{id}", productHandler.Delete)
		r.Get("/categories", categoryHandler.ListCategories)
		r.Post("/categories", categoryHandler.CreateCategory)
		r.Route("/customers", func(cr chi.Router) {
			cr.Get("/", customerHandler.ListCustomers)
			cr.Post("/", customerHandler.CreateCustomer)
			cr.Get("/{id}", customerHandler.GetCustomer)
			cr.Put("/{id}", customerHandler.UpdateCustomer)
		})
		r.Route("/pets", func(pr chi.Router) {
			pr.Get("/", customerHandler.ListPets)
			pr.Post("/", customerHandler.CreatePet)
			pr.Get("/{id}", customerHandler.GetPet)
			pr.Put("/{id}", customerHandler.UpdatePet)
		})
		r.Route("/services", func(sr chi.Router) {
			sr.Get("/", serviceHandler.ListServices)
			sr.Post("/", serviceHandler.CreateService)
			sr.Get("/{id}", serviceHandler.GetService)
			sr.Put("/{id}", serviceHandler.UpdateService)
		})
		r.Route("/packages", func(pr chi.Router) {
			pr.Get("/", serviceHandler.ListPackages)
			pr.Post("/", serviceHandler.CreatePackage)
			pr.Get("/{id}", serviceHandler.GetPackage)
			pr.Put("/{id}", serviceHandler.UpdatePackage)
		})
		r.Route("/bookings", func(br chi.Router) {
			br.Get("/", bookingHandler.List)
			br.Post("/", bookingHandler.Create)
			br.Get("/{id}", bookingHandler.GetByID)
			br.Post("/{id}/status", bookingHandler.ChangeStatus)
			br.Post("/{id}/complete", bookingHandler.Complete)
		})
		r.Route("/inventory", func(r chi.Router) {
			r.Get("/stocks", inventoryHandler.ListStocks)
			r.Get("/locations", inventoryHandler.ListLocations)
			r.Get("/movements", inventoryHandler.ListMovements)
			r.Post("/movements", inventoryHandler.RecordMovement)
		})
		r.Route("/orders", func(r chi.Router) {
			r.Get("/", orderHandler.ListOrders)
			r.Post("/", orderHandler.CreateOrder)
			r.Get("/{id}", orderHandler.GetOrderByID)
		})
		r.Route("/promos", func(pr chi.Router) {
			pr.Get("/", promoHandler.List)
			pr.Post("/", promoHandler.Create)
			pr.Get("/{id}", promoHandler.GetByID)
			pr.Put("/{id}", promoHandler.Update)
			pr.Delete("/{id}", promoHandler.Delete)
			pr.Post("/validate", promoHandler.Validate)
		})
		r.Route("/shifts", func(sr chi.Router) {
			sr.Post("/open", shiftHandler.OpenShift)
			sr.Get("/current", shiftHandler.GetCurrentShift)
			sr.Post("/close", shiftHandler.CloseShift)
			sr.Post("/{id}/close", shiftHandler.CloseShift)
			sr.Get("/", shiftHandler.ListShifts)
			sr.Get("/{id}", shiftHandler.GetShiftByID)
		})
	})
	if log != nil {
		return loggingMiddleware(log, router)
	}
	return router
}

func tenantMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = r.URL.Query().Get("tenant_id")
		}
		if tenantID == "" {
			tenantID = tenantcontext.DefaultTenantID
		}
		ctx := tenantcontext.WithTenantID(r.Context(), tenantID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Request-ID, X-Tenant-ID, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Info("http request", "method", r.Method, "path", r.URL.Path, "request_id", requestid.FromContext(r.Context()))
		next.ServeHTTP(w, r)
	})
}
