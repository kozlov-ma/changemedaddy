package ui

import (
	"changemedaddy/internal/domain/position"
	_ "embed"

	"github.com/labstack/echo/v4"
)

type PositionForm struct {
	IdeaSlug    string
	AnalystSlug string

	PrevTicker  string
	WrongTicker bool

	PrevTarget  string
	WrongTarget bool

	PrevType  position.Type
	WrongType bool

	PrevDeadline  string
	WrongDeadline bool
}

func NewPosition(ideaSlug, analystSlug string) PositionForm {
	return PositionForm{
		PrevType:    position.Long,
		IdeaSlug:    ideaSlug,
		AnalystSlug: analystSlug,
	}
}

func (p PositionForm) Render(c echo.Context) error {
	return c.Render(200, "new_position.html", p)
}
