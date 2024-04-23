package slugger

import "github.com/gosimple/slug"

type Slugger struct{}

func (sg Slugger) Slug(s string) string {
	return slug.Make(s)
}
