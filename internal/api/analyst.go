package api

import (
	"changemedaddy/internal/aggregate/analyst"
	"changemedaddy/internal/aggregate/idea"
	"changemedaddy/internal/ui"
	"errors"

	"github.com/labstack/echo/v4"
)

func (h *handler) analystMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		var a *analyst.Analyst
		slug := c.Param("analystSlug")
		if slug != "" {
			an, err := h.ar.FindBySlug(c.Request().Context(), slug)
			if errors.Is(err, analyst.ErrNotFound) {
				h.log.Debug("couldn't find analyst: given slug does not exist", "slug", slug)
				return c.Redirect(307, "/404")
			} else if err != nil {
				h.log.Error("couldn't find analyst", "slug", slug, "err", err)
				return c.Redirect(307, "/500")
			}
			a = an
		}

		if a == nil {
			return c.Redirect(307, "/404")
		}

		c.Set("analyst", a)
		return next(c)
	}
}

func (h *handler) getAnalyst(c echo.Context) error {
	a := c.Get("analyst").(*analyst.Analyst)
	if a == nil {
		return ui.Render404(c)
	}

	ideas, err := a.Ideas(c.Request().Context(), h.ir)
	if err != nil {
		h.log.Error("couldn't create position", "err", err)
		return c.Redirect(307, "/500")
	}

	isOwner := c.Get("isOwner").(bool)
	if isOwner {
		return ui.Owner(a, ideas).Render(c)
	} else {
		return ui.Analyst(a, ideas).Render(c)
	}
}

func (h *handler) ideaForm(c echo.Context) error {
	a := c.Get("analyst").(*analyst.Analyst)
	if a == nil {
		h.log.Debug("tried to add idea to a non-existent analyst")
		return c.Redirect(307, "/404")
	}

	return ui.NewIdea(a.Slug).Render(c)
}

func (h *handler) addIdea(c echo.Context) error {
	a := c.Get("analyst").(*analyst.Analyst)

	if a == nil {
		h.log.Debug("tried to add idea to a non-existent analyst")
		return c.Redirect(307, "/404")
	}

	var io analyst.IdeaCreationOptions
	if err := c.Bind(&io); err != nil {
		h.log.Warn("couldn't bind idea creation options", "err", err)
		return c.Redirect(307, "/400")
	}

	i, err := a.NewIdea(c.Request().Context(), h.ir, io)
	if errors.Is(err, idea.ErrConflict) || errors.Is(err, idea.ErrNameTooShort) || errors.Is(err, idea.ErrNameTooLong) {
		ui.IdeaForm{
			AnalystSlug:  a.Slug,
			PrevName:     io.Name,
			PrevLink:     io.SourceLink,
			NameTooLong:  errors.Is(err, idea.ErrNameTooLong),
			NameTooShort: errors.Is(err, idea.ErrNameTooShort),
			NameTaken:    errors.Is(err, idea.ErrConflict),
		}.Render(c)
		return err
	} else if err != nil {
		h.log.Error("couldn't create idea", "err", err)
		return c.Redirect(307, "/500")
	}

	return ui.IdeaCard(ui.Idea(i, false)).Render(c)
}
