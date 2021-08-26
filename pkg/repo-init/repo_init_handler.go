package repo_init

import (
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"strings"
	"time"

	"github.com/sirupsen/logrus"

	prowConfig "k8s.io/test-infra/prow/config"
	"k8s.io/test-infra/prow/flagutil"
	"k8s.io/test-infra/prow/interrupts"
	"k8s.io/test-infra/prow/logrusutil"
	"k8s.io/test-infra/prow/metrics"
	"k8s.io/test-infra/prow/simplifypath"
)

var baseTemplate *template.Template
var errTemplate *template.Template

func init() {
	var err error
	if baseTemplate, err = template.ParseFiles("/home/eberglin/dev/projects/openshift/ci-tools/pkg/repo-init/templates/repo-init.html"); err != nil {
		panic(fmt.Sprintf("Failed to parse the base template: %v", err))
	}
	if errTemplate, err = template.ParseFiles("/home/eberglin/dev/projects/openshift/ci-tools/pkg/repo-init/templates/error.html"); err != nil {
		panic(fmt.Sprintf("Failed to parse the error template: %v", err))
	}
}

// l and v keep the tree legible
func l(fragment string, children ...simplifypath.Node) simplifypath.Node {
	return simplifypath.L(fragment, children...)
}

//var (
//	repoInitMetrics = metrics.NewMetrics("repo-init")
//)

func Handler() {
	logrusutil.ComponentInit()

	//health := pjutil.NewHealthOnPort(8082)
	metrics.ExposeMetrics("repo-initializer", prowConfig.PushGateway{}, flagutil.DefaultMetricsPort)
	//simplifier := simplifypath.NewSimplifier(l("", // shadow element mimicing the root
	//	l("save"),
	//	l("resolve"),
	//	l("configGeneration"),
	//	l("registryGeneration"),
	//))
	//
	//uisimplifier := simplifypath.NewSimplifier(l("", // shadow element mimicing the root
	//	l(""),
	//	//l("help",
	//	//	l("adding-components"),
	//	//	l("examples"),
	//	//	l("ci-operator"),
	//	//	l("leases"),
	//	//),
	//	//l("search"),
	//	//l("job"),
	//	//l("reference"),
	//	//l("chain"),
	//	//l("workflow"),
	//))
	//handler := metrics.TraceHandler(simplifier, nil, nil)
	//uihandler := metrics.TraceHandler(uisimplifier, nil, nil)
	// add handler func for incorrect paths as well; can help with identifying errors/404s caused by incorrect paths
	//http.HandleFunc("/", handler(http.HandlerFunc(http.NotFound)).ServeHTTP)
	//http.HandleFunc("/save", handler(resolveConfig(configAgent, registryAgent)).ServeHTTP)
	//interrupts.ListenAndServe(&http.Server{Addr: ":8080" + strconv.Itoa(8080}, o.gracePeriod)
	fs := http.FileServer(http.Dir("/home/eberglin/dev/projects/openshift/ci-tools/pkg/repo-init/static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))
	//interrupts.ListenAndServe(&http.Server{Addr: ":8080"}, time.Minute)
	http.HandleFunc("/", uiHandler)
	//uiServer := &http.Server{
	//	Addr:    ":" + strconv.Itoa(8081),
	//	Handler: uiHandler(),
	//}
	interrupts.ListenAndServe(&http.Server{Addr: ":8081"}, time.Minute)
	//health.ServeReady()
	interrupts.WaitForGracefulShutdown()
}

func uiHandler(w http.ResponseWriter, req *http.Request) {
		trimmedPath := strings.TrimPrefix(req.URL.Path, req.URL.Host)
		// remove leading slash
		trimmedPath = strings.TrimPrefix(trimmedPath, "/")
		// remove trailing slash
		trimmedPath = strings.TrimSuffix(trimmedPath, "/")
		splitURI := strings.Split(trimmedPath, "/")
		if len(splitURI) == 1 {
			switch splitURI[0] {
			case "":
				mainPageHandler(w, req)
			default:
				writeErrorPage(w, errors.New("Invalid path"), http.StatusNotImplemented)
			}
			return
		}
		writeErrorPage(w, errors.New("Invalid path"), http.StatusNotImplemented)
	}

func mainPageHandler(w http.ResponseWriter, _ *http.Request) {
	start := time.Now()
	defer func() { logrus.Infof("rendered in %s", time.Since(start)) }()

	w.Header().Set("Content-Type", "text/html;charset=UTF-8")
	page, err := baseTemplate.Clone()
	if err != nil {
		writeErrorPage(w, err, http.StatusInternalServerError)
		return
	}
	//if page, err = page.Parse(templateString); err != nil {
	//	writeErrorPage(w, err, http.StatusInternalServerError)
	//	return
	//}
	//comps := struct {
	//	References registry.ReferenceByName
	//	Chains     registry.ChainByName
	//	Workflows  registry.WorkflowByName
	//}{
	//	References: refs,
	//	Chains:     chains,
	//	Workflows:  workflows,
	//}

	data := struct {
		Title string
	} {
		Title: "Beep",
	}
	writePage(w, page, data)
}

func writeErrorPage(w http.ResponseWriter, pageErr error, status int) {
	//errPage, err := template.New("errPage").Parse(errPage)
	//if err != nil {
	//	w.WriteHeader(http.StatusInternalServerError)
	//	fmt.Fprintf(w, "%s: %v", http.StatusText(http.StatusInternalServerError), err)
	//	return
	//}
	w.WriteHeader(status)
	data := struct {
		Title string
	} {
		Title: "Error",
	}
	writePage(w, errTemplate, data)
}

func writePage(w http.ResponseWriter, body *template.Template, data interface{}) {
	//fmt.Fprintf(w, htmlPageStart, title)
	if err := body.Execute(w, data); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, "%s: %v", http.StatusText(http.StatusInternalServerError), err)
		return
	}
	//fmt.Fprintln(w, htmlPageEnd)
}
