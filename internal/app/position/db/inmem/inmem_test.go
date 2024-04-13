package inmem

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/shopspring/decimal"

	"changemedaddy/internal/app/position"
)

func TestRepository_FindByID(t *testing.T) {
	pos := &position.Position{
		CreatedByID: "MK",
		Slug:        "mgnt-tema",
		Ticker:      "MGNT",
		Type:        position.TypeLong,
		TargetPrice: decimal.NewFromInt(11000),
		Lots: []position.Lot{
			{
				Amount: 300,
				Price:  decimal.NewFromInt(7841),
			},
		},
		CreatedAt: time.Date(2024, time.March, 18, 12, 0, 0, 0, time.Local),
		Deadline:  time.Date(2024, time.May, 28, 14, 41, 30, 0, time.Local),
	}

	db := NewRepository()

	pos, err := db.Create(context.Background(), pos)
	if err != nil {
		t.Fatalf("couldn't create a position: %v", err)
	}

	got1, err := db.FindByID(context.Background(), pos.ID)
	if err != nil {
		t.Fatalf("couldn't find a position by id: %v", err)
	}

	got2, err := db.FindByID(context.Background(), pos.ID)
	if err != nil {
		t.Fatalf("couldn't find a position by id: %v", err)
	}

	got2.Slug = "changed" // change the slug in the second copy, must not affect the first one

	if reflect.DeepEqual(got1, got2) {
		t.Errorf("want different copies (got1 != got2), got %v", got1)
	}
}
