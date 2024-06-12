package css

type ValueReader interface {
	Read(from string) (converted string, ok bool)
}

type Class struct {
	Name string
	Val  ValueReader
}

bg-white
bg-opacity-30
