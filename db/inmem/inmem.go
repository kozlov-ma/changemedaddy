package inmem

import (
	"context"
	"sync"

	"changemedaddy/db"
	"changemedaddy/invest"
)

type DB struct {
	posLock   sync.RWMutex
	posCtr    int64
	positions map[int64]invest.Position
}

func New() *DB {
	return &DB{
		positions: make(map[int64]invest.Position),
	}
}

func (d *DB) AddPosition(ctx context.Context, pos invest.Position) (int64, error) {
	d.posLock.Lock()
	defer d.posLock.Unlock()

	id := d.posCtr + 1

	d.positions[id] = pos
	d.posCtr++

	return id, nil
}

func (d *DB) PutPosition(ctx context.Context, id int64, pos invest.Position) error {
	d.posLock.Lock()
	defer d.posLock.Unlock()

	_, ok := d.positions[id]
	if !ok {
		return db.ErrPositionDoesNotExist
	}

	d.positions[id] = pos

	return nil
}

func (d *DB) GetPosition(ctx context.Context, id int64) (pos invest.Position, err error) {
	d.posLock.RLock()
	defer d.posLock.RUnlock()

	pos, ok := d.positions[id]
	if !ok {
		return pos, db.ErrPositionDoesNotExist
	}

	return pos, nil
}
