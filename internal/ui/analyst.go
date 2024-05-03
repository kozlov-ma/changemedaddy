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
	Ideas []IdeaComponent
}

func Analyst(a *analyst.Analyst, ideas []*idea.Idea) AnalystComponent {
	var ii []IdeaComponent
	for _, i := range ideas {
		ii = append(ii, Idea(i))
	}

	return AnalystComponent{
		Name:  a.Name,
		Slug:  a.Slug,
		Ideas: ii,
	}
}

func (a AnalystComponent) Render(c echo.Context) error {
	return c.Render(200, "analyst.html", a)
}
