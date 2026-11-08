LESS := npm exec -- lessc
ESBUILD := npm exec -- esbuild
TSC := npm exec -- tsc
APP := app
CSS := $(APP)/cyp.css
JS := $(APP)/cyp.js
ICONS := $(APP)/js/icons.ts
SYSD_USER := ~/.config/systemd/user
SERVICE := cyp.service

all: typecheck $(CSS) $(JS) index.js fetcher.js

# type checks the page (app/) and the server; esbuild below only strips the types
typecheck:
	$(TSC) -p app
	$(TSC) -p .

icons: $(ICONS)

$(ICONS): $(APP)/icons/*
	$(APP)/svg2js.sh $(APP)/icons > $@

$(JS): $(APP)/js/* $(APP)/js/elements/* api.ts
	$(ESBUILD) --bundle --target=es2017 $(APP)/js/cyp.ts --outfile=$@

# the server: index.ts (routes) loads fetcher.js, compiled from fetcher.ts
index.js: index.ts fetcher.ts api.ts
	$(ESBUILD) index.ts --platform=node --format=cjs --target=node10 --outfile=$@

# second sync (node side), written in TypeScript; index.js loads the compiled fetcher.js
fetcher.js: fetcher.ts api.ts
	$(ESBUILD) fetcher.ts --platform=node --format=cjs --target=node10 --outfile=$@

$(CSS): $(APP)/css/* $(APP)/css/elements/*
	$(LESS) -x $(APP)/css/cyp.less > $@

service: $(SERVICE)
	systemctl --user enable $(PWD)/$(SERVICE)

$(SERVICE): misc/cyp.service.template
	cat $^ | envsubst > $@

watch: all
	while inotifywait -e MODIFY -r --exclude '~$$' $(APP)/css $(APP)/js ; do make $^ ; done

clean:
	rm -f $(SERVICE) $(CSS) $(JS) index.js fetcher.js

docker-image:
	docker build -t cyp .

docker-run:
	docker run --network=host -v "$$(pwd)"/_youtube:/cyp/_youtube cyp

.PHONY: all typecheck watch icons service clean

.DELETE_ON_ERROR:
