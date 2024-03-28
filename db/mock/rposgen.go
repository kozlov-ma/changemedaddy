package mock

import (
	"changemedaddy/db"
	"changemedaddy/invest"
	"math/rand/v2"
)

type RandomPositionGenerator struct {
	ti []string

	pk []invest.PositionKind
	it []invest.InstrumentType
	ps []invest.PositionStatus

	sp []float64
	tp []float64
}

func (r RandomPositionGenerator) GetPosition(id int64, idx int) (invest.Position, error) {
	p := invest.Position{
		Ticker:         mustChoose(r.ti),
		InstrumentType: mustChoose(r.it),
		StartPrice:     mustChoose(r.sp),
		TargetPrice:    mustChoose(r.tp),
		RelAmount:      100,
	}

	if rand.IntN(10) == 7 {
		return invest.Position{}, db.PositionDoesNotExistError
	}

	return p, nil
}

func NewRandPosGen() RandomPositionGenerator {
	return RandomPositionGenerator{
		ti: []string{"YNDX", "MGNT", "MAGN", "GAZP", "SBER"},
		pk: []invest.PositionKind{invest.KindLong, invest.KindShort},
		it: []invest.InstrumentType{invest.TypeShares},
		ps: []invest.PositionStatus{invest.StatusOpen},
		sp: []float64{300, 400, 500, 600, 700, 800, 1000, 2000, 3000, 4000},
		tp: []float64{100, 200, 300, 400, 500, 600, 700, 800, 900, 2000, 2700},
	}
}

func mustChoose[T any](s []T) T {
	if len(s) == 0 {
		panic("cannot choose from an empty slice")
	}

	idx := rand.Int() % len(s)
	return s[idx]
}
