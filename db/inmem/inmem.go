package inmem

import (
	"changemedaddy/db"
	"changemedaddy/invest"
	"github.com/go-playground/validator/v10"
	"sync"
)

type DB struct {
	validate validator.Validate

	posLock   sync.RWMutex
	posCtr    int64
	positions map[int64]invest.Position
}

func New() *DB {
	return &DB{
		positions: make(map[int64]invest.Position),
	}
}

func (d *DB) AddPosition(pos invest.Position) (int64, error) {
	d.posLock.Lock()
	defer d.posLock.Unlock()

	id := d.posCtr + 1

	d.positions[id] = pos
	d.posCtr++

	return id, nil
}

func (d *DB) PutPosition(id int64, pos invest.Position) error {
	d.posLock.Lock()
	defer d.posLock.Unlock()

	_, ok := d.positions[id]
	if !ok {
		return db.PositionDoesNotExistError
	}

	d.positions[id] = pos

	return nil
}

func (d *DB) GetPosition(id int64) (pos invest.Position, err error) {
	d.posLock.RLock()
	defer d.posLock.RUnlock()

	pos, ok := d.positions[id]
	if !ok {
		return pos, db.PositionDoesNotExistError
	}

	return pos, nil
}
