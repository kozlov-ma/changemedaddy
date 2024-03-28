package invest

import (
	"errors"
	"math"
	"testing"
	"time"
)

func yndxTest() Position {
	return Position{
		Ticker:         "YNDX",
		Kind:           KindLong,
		InstrumentType: TypeShares,
		RelAmount:      100,
		StartPrice:     3800,
		TargetPrice:    4000,
	}
}

// TestAmountChangeFixedProfit tests for correctness of recalculated Position.FixedProfit.
func TestAmountChangeFixedProfit(t *testing.T) {
	var (
		long    = yndxTest()
		soldAll = AmountChange{Time: time.Now(), Delta: -100, Price: 4000}
	)

	err := soldAll.Check(long)
	if err != nil {
		t.Fatal("soldAll didn't pass checks but was correct, error:", err)
	}

	applied := soldAll.Apply(long)

	if applied.Status() != StatusClosed {
		t.Error("soldAll; want StatusClosed, got", applied.Status())
	}

	if len(applied.Log) != 1 {
		t.Error("had one position change, want log length 1, got", len(applied.Log))
	}

	if applied.RelAmount != 0 {
		t.Error("soldAll; want RelAmount 0, got", applied.RelAmount)
	}

	if applied.StartPrice != long.StartPrice {
		t.Error("did not buy any; did not expect StartPrice to change; want", long.StartPrice, "got", applied.StartPrice)
	}

	wantProfit := 5.2631578947
	if math.Abs(applied.FixedProfitP-wantProfit) > 1e-9 {
		t.Error("wrong FixedProfitP calculation, want", wantProfit, "got", applied.FixedProfitP)
	}
}

// TestAmountChangeCheck tests for various invalid change cases.
func TestAmountChangeCheck(t *testing.T) {
	var (
		long        = yndxTest()
		soldTooMuch = AmountChange{Time: time.Now(), Delta: -12312312, Price: 12312312}
		soldAll     = AmountChange{Time: time.Now(), Delta: -100, Price: 4000}
	)

	err := soldTooMuch.Check(long)
	if !errors.Is(err, TooBigAbsDelta) {
		t.Error("sold enough to flip position, want TooBigAbsDelta, got", err)
	}

	applied := soldAll.Apply(long)

	err = soldAll.Check(applied)
	if !errors.Is(err, CannotChangeClosedPosition) {
		t.Error("tried to change closed position, want CannotChangeClosedPosition, got", err)
	}
}
