package httpserver

import (
	"database/sql"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/assistant"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/inventory"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/orders"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/products"
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
	if db != nil {
		productRepo = products.NewPostgresRepository(db)
		inventoryRepo = inventory.NewPostgresRepository(db)
		orderRepo = orders.NewPostgresRepository(db)
		tenantRepo = tenant.NewPostgresRepository(db)
		shiftRepo = shifts.NewPostgresRepository(db)
	} else {
		productRepo = products.NewMemoryRepository()
		inventoryRepo = inventory.NewMemoryRepository()
		orderRepo = orders.NewMemoryRepository(inventoryRepo)
		tenantRepo = tenant.NewMemoryRepository()
		shiftRepo = shifts.NewMemoryRepository()
	}
	return NewRouterWithAllRepos(log, ready, productRepo, inventoryRepo, orderRepo, tenantRepo, shiftRepo, configurations...)
}

func NewRouterWithRepo(log *slog.Logger, ready health.Check, productRepo products.Repository, configurations ...config.Config) http.Handler {
	inv := inventory.NewMemoryRepository()
	return NewRouterWithAllRepos(log, ready, productRepo, inv, orders.NewMemoryRepository(inv), tenant.NewMemoryRepository(), shifts.NewMemoryRepository(), configurations...)
}

func NewRouterWithRepos(log *slog.Logger, ready health.Check, productRepo products.Repository, inventoryRepo inventory.Repository, configurations ...config.Config) http.Handler {
	return NewRouterWithAllRepos(log, ready, productRepo, inventoryRepo, orders.NewMemoryRepository(inventoryRepo), tenant.NewMemoryRepository(), shifts.NewMemoryRepository(), configurations...)
}

func NewRouterWithAllRepos(log *slog.Logger, ready health.Check, productRepo products.Repository, inventoryRepo inventory.Repository, orderRepo orders.Repository, tenantRepo tenant.Repository, shiftRepo shifts.Repository, configurations ...config.Config) http.Handler {
	cfg := config.Load()
	if len(configurations) > 0 {
		cfg = configurations[0]
	}
	router := chi.NewRouter()
	router.Use(requestid.Middleware)
	router.Use(tenantMiddleware)
	router.Use(middleware.Recoverer)
	router.Use(cors)
	router.NotFound(func(w http.ResponseWriter, r *http.Request) {
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
	uploadHandler := uploads.NewHandler("./uploads")

	router.Get("/health/live", healthHandler.Live)
	router.Get("/health/ready", healthHandler.Ready)
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
		r.Get("/products", productHandler.List)
		r.Post("/products", productHandler.Create)
		r.Put("/products/{id}", productHandler.Update)
		r.Delete("/products/{id}", productHandler.Delete)
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
		if origin == "http://localhost:5173" || origin == "http://127.0.0.1:5173" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
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
