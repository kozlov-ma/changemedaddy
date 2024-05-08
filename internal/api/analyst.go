package api

import (
	"changemedaddy/internal/aggregate/analyst"
	"changemedaddy/internal/aggregate/idea"
	"changemedaddy/internal/ui"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

func (h *handler) analystMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		var a *analyst.Analyst

		idS := c.Param("analystID")
		if idS != "" {
			id, err := strconv.Atoi(idS)
			if err != nil {
				h.log.Debug("tried to get analyst with wrong id", "id", id, "err", err)
				ui.Render404(c)
				return err
			}

			an, err := h.ar.Find(c.Request().Context(), id)
			if errors.Is(err, analyst.ErrNotFound) {
				h.log.Debug("couldn't find analyst: given id does not exist", "id", id)
				ui.Render404(c)
				return err
			} else if err != nil {
				h.log.Error("couldn't find analyst", "id", id, "err", err)
				ui.Render500(c)
				return err
			}
			a = an
		}

		slug := c.Param("analystSlug")
		if slug != "" {
			an, err := h.ar.FindBySlug(c.Request().Context(), slug)
			if errors.Is(err, analyst.ErrNotFound) {
				h.log.Debug("couldn't find analyst: given slug does not exist", "slug", slug)
				ui.Render404(c)
				return err
			} else if err != nil {
				h.log.Error("couldn't find analyst", "slug", slug, "err", err)
				ui.Render500(c)
				return err
			}
			a = an
		}

		c.Set("analyst", a)
		return next(c)
	}
}

func (h *handler) register(c echo.Context) error {
	return ui.NewAnalyst().Render(c)
}

func (h *handler) newAnalyst(c echo.Context) error {
	var co analyst.CreationOptions
	if err := c.Bind(&co); err != nil {
		h.log.Warn("couldn't bind analyst creation options", "err", err)
		ui.Render400(c)
		return err
	}

	a, err := analyst.New(c.Request().Context(), h.ar, co)
	if errors.Is(err, analyst.ErrNameTooShort) || errors.Is(err, analyst.ErrNameTooLong) || errors.Is(err, analyst.ErrDuplicateName) {
		ui.AnalystForm{
			PrevName:     co.Name,
			NameTooLong:  errors.Is(err, analyst.ErrNameTooLong),
			NameTooShort: errors.Is(err, analyst.ErrNameTooShort),
			NameTaken:    errors.Is(err, analyst.ErrDuplicateName),
		}.Render(c)
		return err
	} else if err != nil {
		h.log.Error("couldn't create analyst", "err", err)
		ui.Render500(c)
		return err
	}

	return c.Redirect(http.StatusFound, fmt.Sprintf("/analyst/%s", a.Slug))
}

func (h *handler) getAnalyst(c echo.Context) error {
	a := c.Get("analyst").(*analyst.Analyst)
	if a == nil {
		return ui.Render404(c)
	}

	ideas, err := a.Ideas(c.Request().Context(), h.ir)
	if err != nil {
		h.log.Error("couldn't create position", "err", err)
		ui.Render500(c)
		return err
	}

	return ui.Analyst(a, ideas).Render(c)
}

func (h *handler) ideaForm(c echo.Context) error {
	a := c.Get("analyst").(*analyst.Analyst)
	if a == nil {
		h.log.Debug("tried to add idea to a non-existent analyst")
		return ui.Render404(c)
	}

	return ui.NewIdea(a.Slug).Render(c)
}

func (h *handler) addIdea(c echo.Context) error {
	a := c.Get("analyst").(*analyst.Analyst)
	if a == nil {
		h.log.Debug("tried to add idea to a non-existent analyst")
		return ui.Render404(c)
	}

	var io analyst.IdeaCreationOptions
	if err := c.Bind(&io); err != nil {
		h.log.Warn("couldn't bind idea creation options", "err", err)
		ui.Render400(c)
		return err
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
		ui.Render500(c)
		return err
	}

	return ui.IdeaCard(ui.Idea(i)).Render(c)
}
