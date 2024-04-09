package inmem

import (
	"changemedaddy/invest"
	"context"
	"reflect"
	"testing"
	"time"
)

func yndxTest() invest.Position {
	return invest.Position{
		Ticker:         "YNDX",
		Kind:           invest.KindLong,
		InstrumentType: invest.TypeShares,
		Start:          time.Date(2024, time.February, 18, 12, 0, 0, 0, time.Local),
		Deadline:       time.Date(2024, time.April, 28, 14, 41, 30, 0, time.Local),
		RelAmount:      100,
		StartPrice:     3800,
		TargetPrice:    4000,
	}
}

func tcsgTest() invest.Position {
	return invest.Position{
		Ticker:         "TCSG",
		Kind:           invest.KindLong,
		InstrumentType: invest.TypeShares,
		Start:          time.Date(2024, time.February, 18, 12, 0, 0, 0, time.Local),
		Deadline:       time.Date(2024, time.April, 28, 14, 41, 30, 0, time.Local),
		RelAmount:      10,
		StartPrice:     1300,
		TargetPrice:    1350,
		FixedProfitP:   0,
		Log:            nil,
	}
}

func TestDB_AddPosition(t *testing.T) {
	db := New()

	pos1 := yndxTest()
	firstId, err := db.AddPosition(context.TODO(), pos1)
	if err != nil {
		t.Fatal("couldn't add a position to the database", pos1, err)
	}

	if firstId == 0 {
		t.Error("want id != 0, got 0")
	}

	pos2 := tcsgTest()
	secondId, err := db.AddPosition(context.TODO(), pos2)
	if err != nil {
		t.Fatal("couldn't add a position to the database", pos1, err)
	}

	if secondId == 0 {
		t.Error("want id != 0, got 0")
	}

	if firstId == secondId {
		t.Error("added two separate ideas to the database, want different ids, got", firstId, "and", secondId)
	}
}

func TestDB_GetPosition(t *testing.T) {
	t.Run("GetPosition", func(t *testing.T) {
		ok := t.Run("AddPosition", TestDB_AddPosition)
		if !ok {
			t.Skip("skipping because TestDB_AddPosition failed")
		}
	})

	var (
		db          = New()
		firstId, _  = db.AddPosition(context.TODO(), yndxTest())
		secondId, _ = db.AddPosition(context.TODO(), tcsgTest())
	)

	pos1, err := db.GetPosition(context.TODO(), firstId)
	if err != nil {
		t.Fatal("couldn't retrieve an added position", err)
	}

	if !reflect.DeepEqual(yndxTest(), pos1) {
		t.Error("want retrieved position equal to added, added", yndxTest(), "got", pos1)
	}

	pos2, err := db.GetPosition(context.TODO(), secondId)
	if err != nil {
		t.Fatal("couldn't retrieve an added position", err)
	}

	if !reflect.DeepEqual(tcsgTest(), pos2) {
		t.Error("want retrieved position equal to added, added", tcsgTest(), "got", pos2)
	}

	if reflect.DeepEqual(pos1, pos2) {
		t.Error("added different positions, want different, got same", pos1, pos2)
	}
}

func TestDB_UpdatePosition(t *testing.T) {
	t.Run("PutPosition", func(t *testing.T) {
		ok := t.Run("AddPosition", TestDB_AddPosition)
		if !ok {
			t.Skip("skipping because TestDB_AddPosition failed")
		}
	})

	t.Run("PutPosition", func(t *testing.T) {
		ok := t.Run("GetPosition", TestDB_GetPosition)
		if !ok {
			t.Skip("skipping because TestDB_GetPosition failed")
		}
	})

	var (
		db    = New()
		old   = yndxTest()
		new   = tcsgTest()
		id, _ = db.AddPosition(context.TODO(), old)
	)

	err := db.PutPosition(context.TODO(), id, new)
	if err != nil {
		t.Fatal("couldn't update a position", err)
	}

	pos, _ := db.GetPosition(context.TODO(), id)
	if reflect.DeepEqual(pos, old) {
		t.Error("want updated position different from old, got same", old, pos)
	}

	if !reflect.DeepEqual(pos, new) {
		t.Error("want updated position equal to new, new", new, "got", pos)
	}
}
