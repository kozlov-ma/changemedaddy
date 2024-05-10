package auth

import (
	"changemedaddy/internal/aggregate/analyst"
	"context"
	"math/rand/v2"
	"strconv"
	"sync"
)

type fakeService struct {
	mu         sync.Mutex
	fromCookie map[string]int
	ids        map[int]struct{}
}

func NewFake() *fakeService {
	return &fakeService{
		fromCookie: make(map[string]int),
		ids:        make(map[int]struct{}),
	}
}

func (f *fakeService) RegID(ctx context.Context, id int) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if _, ok := f.ids[id]; ok {
		return "", analyst.ErrAlreadyRegistered
	}

	f.ids[id] = struct{}{}

	cookie := strconv.Itoa(int(rand.Int64()))
	f.fromCookie[cookie] = id

	return cookie, nil
}

func (f *fakeService) GetID(ctx context.Context, cookie string) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	id, ok := f.fromCookie[cookie]
	if !ok {
		return 0, analyst.ErrNotFound
	}

	return id, nil
}
