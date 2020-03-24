# gitlab-ldap-group-sync

Fork from https://github.com/gitlab-tools/gitlab-ldap-group-sync

It provides a way to sync ldap group members with gitlab groups.

This fork of the project provides a way to configure a relation between ldap groups

## Prerequisites

Node JS

## Installation

Clone the repository and create a `config.json` file.

```bash
git clone https://github.com/gitlab-tools/gitlab-ldap-group-sync.git
cd gitlab-ldap-group-sync
cp config.sample.yml config.json
npm install
```

## Configuration

See: [config.sample.yml ](config.sample.yml )

```yaml
---
## Service port, enables confirmation that it is working
port: 8080
## syncronization interval, eg 5m, 1h
syncInterval: 5m
gitlab:
  api: https://repo.mwaysolutions.com/api/v4
  privateToken: My_S3Cr3T_T0k3n
ldap:
  servers:
  - url: ldaps://ldap.example.com
    baseDN: OU=AADDC Users,DC=example,DC=com
    username: ldap@example.com
    password: mY_S3Cr3T_P455W0Rd
groupPrefix: gitlab-
ownersGroups: admins
ownerAccessLevel: 50
defaultAccessLevel: 30
groupMappings:
## The group id can be found in the properties of every gitlab project
  '1':
    groupPath: service-ops/devops
## removeUnlistedUsers: in case of true, will remove all users added previously not contained in the ldap group
    removeUnlistedUsers: true
    ldapGroups:
    - ldapGroupName: DevOps_group
## Access level information in https://docs.gitlab.com/ee/user/permissions.html#project-members-permissions
## guest: 10
## reporter: 20
## developer: 30
## maintainer: 40
## owner: 50
      access_level: 50
  '10':
    groupPath: service-ops/applications
    removeUnlistedUsers: false
    ldapGroups:
    - ldapGroupName: Applications_group
      access_level: 50
    - ldapGroupName: Applications_developers_group
      access_level: 30
```

## Usage

Just start the node application.

```bash
npm start
```

### Docker

```bash
docker build . -t gitlab-ldap-group-sync
```

Run in windows:

```bash
docker run --rm -v %cd%/config.yml:/opt/gitlab_ldap_group_sync/config.yml gitlab-ldap-group-sync
```

Run in linux:

```bash
docker run --rm -v $(pwd)/config.yml:/opt/gitlab_ldap_group_sync/config.yml gitlab-ldap-group-sync
```

or Using the public docker hub image:

```bash
docker run --rm -v %cd%/config.yml:/opt/gitlab_ldap_group_sync/config.yml kubekub/gitlab-ldap-group-sync:latest
```

### Kubernetes

The repository contains a helm chart for the application execution.

First we need con configure a helm-values.yml, for example with:

```bash
git clone https://github.com/gitlab-tools/gitlab-ldap-group-sync.git
cd gitlab-ldap-group-sync
cp helm-values.sample.yml helm-values.yml
```

Edit the values in the helm-values.yml

And run helm3:

```bash
helm3 upgrade --install group-sync ./charts/gitlab-ldap-group-sync --namespace <namespace> -f helm-values.yml
```

