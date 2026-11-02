import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.05'], // http errors should be less than 5%
    http_req_duration: ['p(95)<1500'], // 95% of requests should be below 1.5s
  },
};

const BASE_URL = 'https://delish-bakes-order.aboodterawi3.workers.dev';

export default function () {
  // 1. Storefront Home page
  const homeRes = http.get(`${BASE_URL}/`);
  check(homeRes, {
    'home status is 200': (r) => r.status === 200,
    'home body is not empty': (r) => r.body && r.body.length > 0,
  });

  sleep(0.2);

  // 2. Staff portal route
  const staffRes = http.get(`${BASE_URL}/staff`);
  check(staffRes, {
    'staff status is 200': (r) => r.status === 200,
  });

  sleep(0.2);
}
