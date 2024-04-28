package ui

import (
	_ "embed"
	"strings"

	"changemedaddy/internal/domain/position"

	"github.com/goodsign/monday"
	"github.com/greatcloak/decimal"
	"github.com/labstack/echo/v4"
)

type PositionComponent struct {
	ID        int
	Ticker    string
	AssetName string
	Type      string

	Profitable bool
	ProfitP    string

	IsClosed   bool
	ClosePrice decimal.Decimal

	OpenPrice decimal.Decimal
	CurPrice  decimal.Decimal

	TargetPrice decimal.Decimal
	Change      string
	ChangeP     string
	ChangeUp    bool

	Deadline string
	OpenDate string
}

func Position(p position.WithProfit) PositionComponent {
	return PositionComponent{
		ID:        p.ID,
		Ticker:    strings.ToUpper(p.Instrument.Ticker),
		Type:      strings.ToUpper(string(p.Type)),
		AssetName: p.Instrument.Name,

		Profitable: p.ProfitP.GreaterThanOrEqual(decimal.Zero),
		ProfitP:    withSign(p.ProfitP),

		IsClosed:   p.Status == position.Closed,
		ClosePrice: p.ClosedPrice,

		OpenPrice: p.OpenPrice,
		CurPrice:  p.Instrument.Price,

		TargetPrice: p.TargetPrice,
		Change:      withSign(p.TargetPrice.Sub(p.Instrument.Price)),
		ChangeP:     withSign(p.TargetPrice.Sub(p.Instrument.Price).Div(p.Instrument.Price).Mul(decimal.NewFromInt(100)).Round(2)),

		Deadline: monday.Format(p.Deadline, "2 January 2006", monday.LocaleRuRU),
		OpenDate: monday.Format(p.OpenDate, "2 January 2006", monday.LocaleRuRU),
	}
}

func (pc PositionComponent) Render(c echo.Context) error {
	return c.Render(200, "position.html", pc)
}
