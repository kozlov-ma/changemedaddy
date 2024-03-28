package invest

import (
	"math"
	"time"
)

var minChangeTime = time.Date(2024, time.March, 26, 19, 31, 0, 0, time.FixedZone("UTC-5", 0))

// PositionChange represents a change that the author of the idea makes to one
// of ideas position after their creation. For example, change the Position.TargetPrice.
type PositionChange interface {
	// Apply is a method that takes a Position and returns another Position
	// with the change applied to it.
	// The change must appear in the new Position's log.
	Apply(Position) Position
	// When is the time when this PositionChange occurred. Is intended for sorting.
	When() time.Time
	// Check checks whether this specific PositionChange is valid for the specific Position.
	// Returns an error if it is not valid, otherwise returns nil.
	Check(Position) error
}

type TargetPriceChange struct {
	Time           time.Time
	NewTargetPrice float64
}

func (t TargetPriceChange) When() time.Time {
	return t.Time
}

func (t TargetPriceChange) Apply(position Position) Position {
	p := position

	p.TargetPrice = t.NewTargetPrice
	p.Log = append(p.Log, t)

	return p
}

func (t TargetPriceChange) Check(p Position) error {
	if p.Status() == StatusClosed {
		return CannotChangeClosedPosition
	}

	if t.Time.Before(minChangeTime) {
		return InvalidChangeTime
	}

	if t.NewTargetPrice <= 0 {
		return InvalidTargetPrice
	}

	return nil
}

type AmountChange struct {
	Time  time.Time
	Delta int
	Price float64
}

func (a AmountChange) When() time.Time {
	return a.Time
}

func (a AmountChange) Apply(position Position) Position {
	p := position

	newAmount := p.RelAmount + a.Delta

	if abs(newAmount) < abs(p.RelAmount) {
		profitP := (math.Abs(float64(a.Delta)) * (a.Price - p.StartPrice)) / (math.Abs(float64(p.RelAmount) * p.StartPrice)) * 100
		p.FixedProfitP += profitP
	} else {
		newPrice := (p.StartPrice*math.Abs(float64(p.RelAmount)) + a.Price*math.Abs(float64(a.Delta))) / math.Abs(float64(newAmount))
		p.StartPrice = newPrice
	}

	p.RelAmount = newAmount
	p.Log = append(p.Log, a)

	return p
}

func (a AmountChange) Check(p Position) error {
	if p.Status() == StatusClosed {
		return CannotChangeClosedPosition
	}

	if a.Time.Before(minChangeTime) {
		return InvalidChangeTime
	}

	if a.Price <= 0 {
		return InvalidPrice
	}

	if a.Delta == 0 {
		return ZeroDeltaError
	}

	// If delta will lead to a short position being converted to long.
	if p.RelAmount < 0 && a.Delta > (-p.RelAmount) {
		return TooBigAbsDelta
	}

	// If delta will lead to a long position being converted to short.
	if p.RelAmount > 0 && a.Delta < (-p.RelAmount) {
		return TooBigAbsDelta
	}

	return nil
}

func abs(x int) int {
	if x < 0 {
		return -x
	}

	return x
}
