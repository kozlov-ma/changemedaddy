package ui

import (
	"changemedaddy/internal/aggregate/idea"

	"github.com/labstack/echo/v4"
)

type IdeaCardComponent struct {
	Name        string
	AnalystSlug string
	Slug        string
}

func IdeaCard(i *idea.Idea) IdeaCardComponent {
	return IdeaCardComponent{
		Name:        i.Name,
		AnalystSlug: i.AuthorSlug,
		Slug:        i.Slug,
	}
}

func (ic IdeaCardComponent) Render(c echo.Context) error {
	return c.Render(200, "idea_card.html", ic)
}
