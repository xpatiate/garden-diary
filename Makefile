deploy:
	npm run build
	~/.npm-global/bin/firebase deploy --only hosting

backup:
	node backup.js

backup-full:
	node backup.js --photos
