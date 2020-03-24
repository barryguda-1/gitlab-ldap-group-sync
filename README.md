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