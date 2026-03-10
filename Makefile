dev:
	npm run dev -- --host 0.0.0.0

deploy:
	npm run build
	~/.npm-global/bin/firebase deploy --only hosting

backup:
	node backup.js

backup-full:
	node backup.js --photos
