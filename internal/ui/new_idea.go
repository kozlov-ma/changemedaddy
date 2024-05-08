package ui

import "github.com/labstack/echo/v4"

type IdeaForm struct {
	AnalystSlug  string
	PrevName     string
	PrevLink     string
	NameTooLong  bool
	NameTooShort bool
	NameTaken    bool
}

func NewIdea(analystSlug string) IdeaForm {
	return IdeaForm{
		AnalystSlug: analystSlug,
	}
}

func (i IdeaForm) Render(c echo.Context) error {
	return c.Render(200, "new_idea.html", i)
}
