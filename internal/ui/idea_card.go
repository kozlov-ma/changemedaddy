package ui

import (
	"github.com/labstack/echo/v4"
)

type IdeaCardComponent struct {
	Name        string
	AnalystSlug string
	Slug        string
	IsActive    bool
}

func IdeaCard(i IdeaComponent) IdeaCardComponent {
	return IdeaCardComponent{
		Name:        i.Name,
		AnalystSlug: i.AuthorSlug,
		Slug:        i.Slug,
		IsActive:    i.IsActive,
	}
}

func (ic IdeaCardComponent) Render(c echo.Context) error {
	return c.Render(200, "idea_card.html", ic)
}
