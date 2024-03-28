package inmem

import (
	"changemedaddy/db"
	"changemedaddy/invest"
	"sync"
)

type DB struct {
	ideaCounter int64
	iLock       sync.RWMutex
	ideas       map[int64]invest.Idea
}

func New() *DB {
	return &DB{
		ideas: make(map[int64]invest.Idea),
	}
}

func (d *DB) AddIdea(idea invest.Idea) (int64, error) {
	d.iLock.Lock()
	defer d.iLock.Unlock()

	id := d.ideaCounter

	d.ideas[id] = idea
	d.ideaCounter++

	return id, nil
}

func (d *DB) UpdateIdea(id int64, idea invest.Idea) error {
	d.iLock.Lock()
	defer d.iLock.Unlock()

	d.ideas[id] = idea

	return nil
}

func (d *DB) GetIdea(id int64) (invest.Idea, error) {
	d.iLock.RLock()
	defer d.iLock.RUnlock()

	idea, ok := d.ideas[id]
	if !ok {
		var zero invest.Idea
		return zero, db.IdeaDoesNotExistError
	}

	return idea, nil
}

func (d *DB) UpdatePosition(ideaId int64, index int, position invest.Position) error {
	d.iLock.Lock()
	defer d.iLock.Unlock()

	idea, ok := d.ideas[ideaId]

	if !ok {
		return db.IdeaDoesNotExistError
	}
	if !(index >= 0 && index < len(idea.Positions)) {
		return db.PositionDoesNotExistError
	}

	idea.Positions[index] = position
	return nil
}

func (d *DB) GetPosition(ideaId int64, posIdx int) (pos invest.Position, err error) {
	d.iLock.RLock()
	defer d.iLock.RUnlock()

	idea, ok := d.ideas[ideaId]
	if !ok {
		return pos, db.IdeaDoesNotExistError
	}

	if !(posIdx >= 0 && posIdx < len(idea.Positions)) {
		return pos, db.PositionDoesNotExistError
	}

	return idea.Positions[posIdx], nil
}
