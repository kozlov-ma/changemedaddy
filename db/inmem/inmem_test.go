package inmem

import (
	"changemedaddy/invest"
	"reflect"
	"testing"
	"time"
)

func yndxPosition() invest.Position {
	return invest.Position{
		Ticker:         "YNDX",
		Kind:           invest.KindLong,
		InstrumentType: invest.TypeShares,
		RelAmount:      100,
		StartPrice:     3800,
		TargetPrice:    4000,
	}
}

func tnkfPosition() invest.Position {
	return invest.Position{
		Ticker:         "TNKF",
		Kind:           invest.KindLong,
		InstrumentType: invest.TypeShares,
		RelAmount:      1000,
		StartPrice:     300,
		TargetPrice:    100,
	}
}

func SimpleIdea() invest.Idea {
	return invest.Idea{
		Positions: []invest.Position{yndxPosition()},
		Deadline:  time.Now(),
	}
}

func CheckError(err error, t *testing.T) {
	if err != nil {
		t.Errorf("%v", err)
	}
}

func TestDbIdea(t *testing.T) {
	db := New()
	idea := SimpleIdea()

	id, err := db.AddIdea(idea)

	CheckError(err, t)
	if id != db.ideaCounter-1 {
		t.Errorf("id %d != %d ideaCounter-1", id, db.ideaCounter-1)
	}

	idea, err = db.GetIdea(id)
	CheckError(err, t)

	var newId int64
	newId = 1

	err = db.UpdateIdea(newId, idea)
	CheckError(err, t)

	var newIdea invest.Idea
	newIdea, err = db.GetIdea(newId)
	CheckError(err, t)

	if !reflect.DeepEqual(newIdea, idea) {
		t.Errorf("%v != %v", newIdea, idea)
	}
}

func TestDbPosition(t *testing.T) {
	db := New()
	idea := SimpleIdea()

	id, _ := db.AddIdea(idea)

	posIdx := 0
	pos, err := db.GetPosition(id, posIdx)
	CheckError(err, t)
	yndx := yndxPosition()
	if !reflect.DeepEqual(pos, yndx) {
		t.Errorf("%v != %v", pos, yndx)
	}

	tnkf := tnkfPosition()
	err = db.UpdatePosition(id, posIdx, tnkf)
	CheckError(err, t)

	pos, err = db.GetPosition(id, posIdx)
	CheckError(err, t)
	if !reflect.DeepEqual(pos, tnkf) {
		t.Errorf("%v != %v", pos, tnkf)
	}
}
