package tenantcontext

import (
	"context"
)

type contextKey struct{}

var tenantKey = contextKey{}

// DefaultTenantID is used for fallback in development or when no tenant is explicitly specified.
const DefaultTenantID = "00000000-0000-0000-0000-000000000001"

// WithTenantID returns a new context containing the given tenant ID.
func WithTenantID(ctx context.Context, tenantID string) context.Context {
	if tenantID == "" {
		tenantID = DefaultTenantID
	}
	return context.WithValue(ctx, tenantKey, tenantID)
}

// FromContext extracts the tenant ID from the context. Returns DefaultTenantID if not found.
func FromContext(ctx context.Context) string {
	if ctx == nil {
		return DefaultTenantID
	}
	if val, ok := ctx.Value(tenantKey).(string); ok && val != "" {
		return val
	}
	return DefaultTenantID
}
