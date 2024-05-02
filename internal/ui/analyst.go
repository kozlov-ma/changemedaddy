package ui

import (
	_ "embed"

	"changemedaddy/internal/aggregate/analyst"
	"changemedaddy/internal/aggregate/idea"

	"github.com/labstack/echo/v4"
)

type AnalystComponent struct {
	ID    int
	Name  string
	Slug  string
	Ideas []*idea.Idea
}

func Analyst(a *analyst.Analyst, ideas []*idea.Idea) AnalystComponent {
	return AnalystComponent{
		Name:  a.Name,
		Slug:  a.Slug,
		Ideas: ideas,
	}
}

func (a AnalystComponent) Render(c echo.Context) error {
	return c.Render(200, "analyst.html", a)
}
