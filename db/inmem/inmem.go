package inmem

import (
	"changemedaddy/db"
	"changemedaddy/invest"
	"sync"
)

type DB struct {
	iCtr       int64
	iLock      sync.RWMutex
	ideas      map[int64]invest.Idea
	ideaPosIDs map[int64][]int64

	pLock     sync.RWMutex
	posCtr    int64
	positions map[int64]invest.Position
	posIdeaID map[int64]int64
}

func New() *DB {
	return &DB{
		ideas:      make(map[int64]invest.Idea),
		ideaPosIDs: make(map[int64][]int64),
		positions:  make(map[int64]invest.Position),
		posIdeaID:  make(map[int64]int64),
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
	d.pLock.RLock()
	defer d.pLock.RUnlock()

	idea, ok := d.ideas[id]
	if !ok {
		return invest.Idea{}, db.IdeaDoesNotExistError
	}

	var positions []invest.Position
	for _, posId := range d.ideaPosIDs[idea.ID] {
		positions = append(positions, d.positions[posId])
	}

	idea.Positions = positions
	return idea, nil
}

func (d *DB) SaveIdea(idea invest.Idea) (invest.Idea, error) {
	d.iLock.Lock()
	defer d.iLock.Unlock()
	d.pLock.Lock()
	defer d.pLock.Unlock()

	d.iCtr++
	idea.ID = d.iCtr

	for _, p := range idea.Positions {
		d.savePosition(idea.ID, p)
	}

	d.ideas[idea.ID] = idea
	clear(d.ideas[idea.ID].Positions)

	return idea, nil
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
