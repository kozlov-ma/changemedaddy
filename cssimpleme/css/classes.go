package css

import (
	"cssimpleme/ast"
	"sync"
	"sync/atomic"
)

type Classes struct {
	registrationComplete atomic.Bool
	mu                   sync.Mutex
	cl                   map[string]*Class
}

func NewClasses() *Classes {
	return &Classes{
		cl: make(map[string]*Class, 5000),
	}
}

func (c *Classes) Find(name string) (cls *Class, ok bool) {
	c.registrationComplete.Store(true)
	cls, ok = c.cl[name]
	return cls, ok
}

func (c *Classes) Static(name string, nodes ...ast.Node) {
	if c.registrationComplete.Load() {
		panic("cannot register new classes after reading")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	c.cl[name] = &Class{
		Name: name,
		Val:  NoValue,
		Handle: func(value string) *ast.Rule {
			return &ast.Rule{
				Selector: name,
				Nodes:    nodes,
			}
		},
	}
}
