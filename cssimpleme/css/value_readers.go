package css

type noValue struct{}

func (n *noValue) Read(fromCls string) (converted string, ok bool) {
	return "", true
}

var NoValue = &noValue{}
