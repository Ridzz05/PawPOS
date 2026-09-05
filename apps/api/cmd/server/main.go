package main

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/muhri/ai-operational-pos/apps/api/internal/httpserver"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/config"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/health"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/logger"
)

func main() {
	cfg := config.Load()
	log := logger.New(cfg.LogLevel)
	var db *sql.DB
	if cfg.DatabaseURL != "" && cfg.DatabaseURL != "none" && cfg.DatabaseURL != "memory" {
		var err error
		db, err = sql.Open("pgx", cfg.DatabaseURL)
		if err != nil {
			log.Error("database setup failed", "error", err)
		} else {
			pingCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			if err := db.PingContext(pingCtx); err != nil {
				log.Warn("database ping failed, falling back to in-memory repository", "error", err)
				_ = db.Close()
				db = nil
			} else {
				defer db.Close()
			}
			cancel()
		}
	} else {
		log.Info("starting in standalone in-memory persistence mode")
	}

	readyCheck := health.Check(nil)
	if db != nil {
		readyCheck = func(ctx context.Context) error {
			pingContext, cancel := context.WithTimeout(ctx, cfg.ReadinessTimeout)
			defer cancel()
			return db.PingContext(pingContext)
		}
	}

	server := &http.Server{Addr: cfg.Address, Handler: httpserver.NewRouter(log, readyCheck, db, cfg), ReadHeaderTimeout: 5 * time.Second}
	serverContext, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		log.Info("api server listening", "address", cfg.Address, "environment", cfg.Environment)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("api server stopped", "error", err)
			stop()
		}
	}()
	<-serverContext.Done()

	shutdownContext, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownContext); err != nil {
		log.Error("api shutdown failed", "error", err)
	}
}
