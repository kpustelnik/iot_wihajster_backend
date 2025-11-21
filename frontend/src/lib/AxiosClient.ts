import axios from 'axios';

const client = axios.create({
    baseURL: 'https://wihajster-back.ivk.pl',
    withCredentials: true
});
export default client;