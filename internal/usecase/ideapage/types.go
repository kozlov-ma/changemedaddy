package ideapage

type (
	FindPageRequest struct {
		CreatedBySlug string
		IdeaSlug      string
	}

	Page struct {
		CreatedBy  string
		OpenDate   string
		Deadline   string
		SourceLink string
		ProfitP    string
		Positions  []Position
	}

	Position struct {
		Name        string
		Ticker      string
		CurPrice    string
		ProfitP     string
		StartPrice  string
		TargetPrice string
	}
)
