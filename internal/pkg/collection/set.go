package collection

type set map[string]bool

func NewSet(items ...string) set {
	set := make(set)
	for _, item := range items {
		set[item] = true
	}
	return set
}

func (set set) Add(item string) {
	set[item] = true
}

func (set set) Remove(item string) {
	delete(set, item)
}

func (set set) Contains(item string) bool {
	return set[item]
}
