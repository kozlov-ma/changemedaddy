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

func (d *DB) UpdateIdea(idea invest.Idea) error {
	d.iLock.Lock()
	defer d.iLock.Unlock()

	if _, ok := d.ideas[idea.ID]; !ok {
		return db.IdeaDoesNotExistError
	}

	for _, p := range idea.Positions {
		err := d.UpdatePosition(p)
		if err != nil {
			return err // todo нельзя так делать
		}
	}
	d.ideas[idea.ID] = idea

	return nil
}

func (d *DB) GetIdea(id int64) (invest.Idea, error) {
	d.iLock.RLock()
	defer d.iLock.RUnlock()

	idea, ok := d.ideas[id]
	if !ok {
		return invest.Idea{}, db.IdeaDoesNotExistError
	}

	return idea, nil
}

func (d *DB) AddIdea(idea invest.Idea) (int64, error) {
	d.iLock.Lock()
	defer d.iLock.Unlock()

	id := d.ideaCounter

	d.ideas[id] = idea
	d.ideaCounter++

	return id, nil
}

func (d *DB) savePosition(ideaID int64, pos invest.Position) {
	d.posCtr++

	pos.ID = d.posCtr

	d.positions[pos.ID] = pos
	d.posIdeaID[pos.ID] = ideaID
	d.ideaPosIDs[ideaID] = append(d.ideaPosIDs[ideaID], pos.ID)
}

func (d *DB) UpdatePosition(pos invest.Position) error {
	d.pLock.Lock()
	defer d.pLock.Unlock()

	if _, ok := d.positions[pos.ID]; !ok {
		return db.PositionDoesNotExistError
	}

	d.positions[pos.ID] = pos
	return nil
}

func (d *DB) GetPosition(id int64) (invest.Position, error) {
	d.pLock.RLock()
	defer d.pLock.RUnlock()

	pos, ok := d.positions[id]
	if !ok {
		return pos, db.PositionDoesNotExistError
	}

	return pos, nil
}
