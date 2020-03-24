FROM node:13.10.1-alpine3.10

MAINTAINER Juan Carlos García Peláez

ENV NODE_ENV production

WORKDIR /opt/gitlab_ldap_group_sync
COPY . /opt/gitlab_ldap_group_sync

RUN npm prune && npm install

RUN touch /opt/gitlab_ldap_group_sync/config.yml

CMD ["node", "./bin/www"]

EXPOSE 8080
