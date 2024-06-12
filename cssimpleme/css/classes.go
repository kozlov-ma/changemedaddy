package css

import (
	"cssimpleme/ast"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/charmbracelet/log"
)

type Classes struct {
	registrationComplete atomic.Bool
	mu                   sync.Mutex
	cl                   map[string][]*Class
}

func NewClasses() *Classes {
	return &Classes{
		cl: make(map[string][]*Class, 5000),
	}
}

func (c *Classes) Find(name string) []*Class {
	c.registrationComplete.Store(true)
	return c.cl[strings.TrimLeft(name, "-")]
}

func (c *Classes) Static(name string, nodes ...ast.Node) {
	if c.registrationComplete.Load() {
		panic("cannot register new classes after reading")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	c.cl[name] = append(c.cl[name], &Class{
		Name: name,
		Val:  NoValue,
		Handle: func(value string) ast.AST {
			return nodes
		},
	})
}

func (c *Classes) Functional(name string, vr ValueReader, vh ValueHandler) {
	if c.registrationComplete.Load() {
		log.Fatal("cannot register new classes after reading")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	c.cl[name] = append(c.cl[name], &Class{
		Name:   name,
		Val:    vr,
		Handle: vh,
	})
}
