package ui

import (
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

	WrongType bool

	PrevDeadline  string
	WrongDeadline bool
}

func NewPosition(ideaSlug, analystSlug string) PositionForm {
	return PositionForm{
		IdeaSlug:    ideaSlug,
		AnalystSlug: analystSlug,
	}
}

func (p PositionForm) Render(c echo.Context) error {
	return c.Render(200, "new_position.html", p)
}
