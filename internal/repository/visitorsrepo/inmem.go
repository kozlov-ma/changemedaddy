package visitorsrepo

import (
	"changemedaddy/internal/aggregate/analyst"
	"context"
	"sync"
	"time"
)

const (
	queryTimeout = time.Second
)

type inmemRepo struct {
	vv sync.Map
}

func NewInmem(ctx context.Context) *inmemRepo {
	return &inmemRepo{}
}

func (r *inmemRepo) Add(ctx context.Context, a *analyst.Analyst, ip string) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	ips, _ := r.vv.LoadOrStore(a.Slug, &sync.Map{})
	ips.(*sync.Map).Store(ip, struct{}{})
}

func (r *inmemRepo) GetAll(ctx context.Context) map[string]int {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	visits := make(map[string]int)
	r.vv.Range(func(key, value any) bool {
		ips := 0
		value.(*sync.Map).Range(func(_, _ interface{}) bool {
			ips++
			return true
		})

		visits[key.(string)] = ips
		return true
	})

	return visits
}
