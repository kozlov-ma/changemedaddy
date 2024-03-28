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

func tcsgPosition() invest.Position {
	return invest.Position{
		Ticker:         "TCSG",
		Kind:           invest.KindLong,
		InstrumentType: invest.TypeShares,
		RelAmount:      10,
		StartPrice:     300,
		TargetPrice:    350,
	}
}

func simpleIdea() invest.Idea {
	return invest.Idea{
		Positions: []invest.Position{yndxPosition()},
		Deadline:  time.Now(),
	}
}

func checkError(err error, t *testing.T) {
	if err != nil {
		t.Errorf("%#v", err)
	}
}

func TestDbIdea(t *testing.T) {
	db := New()
	idea := simpleIdea()

	id, err := db.AddIdea(idea)

	checkError(err, t)
	if id != db.ideaCounter-1 {
		t.Errorf("want id %d, got %d", id, db.ideaCounter-1)
	}

	idea, err = db.GetIdea(id)
	checkError(err, t)

	var newId int64 = 1
	err = db.UpdateIdea(newId, idea)
	checkError(err, t)

	newIdea, err := db.GetIdea(newId)
	checkError(err, t)

	if !reflect.DeepEqual(newIdea, idea) {
		t.Errorf("want idea %#v, got %#v", newIdea, idea)
	}
}

func TestDbPosition(t *testing.T) {
	db := New()
	idea := simpleIdea()

	id, _ := db.AddIdea(idea)

	posIdx := 0
	pos, err := db.GetPosition(id, posIdx)
	checkError(err, t)
	yndx := yndxPosition()
	if !reflect.DeepEqual(pos, yndx) {
		t.Errorf("want %#v, got %#v", pos, yndx)
	}

	tnkf := tcsgPosition()
	err = db.UpdatePosition(id, posIdx, tnkf)
	checkError(err, t)

	pos, err = db.GetPosition(id, posIdx)
	checkError(err, t)
	if !reflect.DeepEqual(pos, tnkf) {
		t.Errorf("want position %#v, got %#v", pos, tnkf)
	}
}
