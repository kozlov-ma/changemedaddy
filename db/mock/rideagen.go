package mock

import (
	"changemedaddy/db"
	"changemedaddy/invest"
	"math/rand/v2"
)

type RandomIdeaGenerator struct {
	rpgen RandomPositionGenerator
}

func (r RandomIdeaGenerator) GetIdea(id int64) (invest.Idea, error) {
	idea := invest.Idea{
		ID: rand.Int64(),
	}

	ps := make([]invest.Position, 0)
	for i := 0; i < 10; i++ {
		p, _ := r.rpgen.GetPosition(id)
		ps = append(ps, p)
	}

	idea.Positions = ps

	if rand.IntN(10) == 7 {
		return invest.Idea{}, db.IdeaDoesNotExistError
	}

	return idea, nil
}

func NewRandIdeaGen() RandomIdeaGenerator {
	return RandomIdeaGenerator{
		rpgen: NewRandPosGen(),
	}
}
