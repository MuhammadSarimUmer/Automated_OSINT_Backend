const axios = require('axios');

const githubApi = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
    }
});

const shodanApi = axios.create({
    baseURL: 'https://api.shodan.io',
    params: {
        key: process.env.SHODAN_API_KEY
    }
});

module.exports = {
    githubApi,
    shodanApi
};