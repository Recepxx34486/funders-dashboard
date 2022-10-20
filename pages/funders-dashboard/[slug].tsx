import React from 'react';
import { gql } from '@apollo/client';
import dayjs from 'dayjs';
import { uniqBy } from 'lodash';
import type { NextPageContext } from 'next';

import { initializeApollo } from '../../lib/apollo-client';

import Layout from '../../components/Layout';

enum TimeScale {
  month = 'month',
  year = 'year',
}

const funderQuery = gql`
  query account(
    $slug: String
    $firstDayOfMonth: DateTime
    $firstDayOfPastMonth: DateTime
    $firstDayOfPreviousMonth: DateTime
  ) {
    account(slug: $slug) {
      slug
      name
      memberOf(role: BACKER, orderBy: { field: TOTAL_CONTRIBUTED, direction: DESC }) {
        nodes {
          id
          account {
            slug
            name
            stats {
              totalAmountReceivedPastMonth: totalAmountReceived(
                dateFrom: $firstDayOfPastMonth
                dateTo: $firstDayOfMonth
                includeChildren: true
              ) {
                value
                currency
              }
              totalAmountSpentPastMonth: totalAmountSpent(
                dateFrom: $firstDayOfPastMonth
                dateTo: $firstDayOfMonth
                includeChildren: true
              ) {
                value
                currency
              }
              totalAmountReceivedPreviousMonth: totalAmountReceived(
                dateFrom: $firstDayOfPreviousMonth
                dateTo: $firstDayOfPastMonth
                includeChildren: true
              ) {
                value
                currency
              }
              totalAmountSpentPreviousMonth: totalAmountSpent(
                dateFrom: $firstDayOfPreviousMonth
                dateTo: $firstDayOfPastMonth
                includeChildren: true
              ) {
                value
                currency
              }
              balance(includeChildren: true) {
                value
                currency
              }
            }
          }
          totalDonations {
            value
            currency
          }
        }
      }
    }
  }
`;

export async function getServerSideProps(context: NextPageContext) {
  const client = initializeApollo({ context });

  let scale: TimeScale = TimeScale.year;
  if (context.query.scale === 'month') {
    scale = TimeScale.month;
  }

  const { data } = await client.query({
    query: funderQuery,
    variables: {
      slug: context.query.slug,
      firstDayOfMonth: dayjs().startOf(scale),
      firstDayOfPastMonth: dayjs().subtract(1, scale).startOf(scale),
      firstDayOfPreviousMonth: dayjs().subtract(2, scale).startOf(scale),
    },
  });

  return {
    props: {
      account: data.account,
      scale,
    },
  };
}

const makeDiff = (afterValue, beforeValue) => {
  if (afterValue === 0 || beforeValue === 0 || afterValue === beforeValue) {
    return '';
  }
  const sign = Math.abs(afterValue) > Math.abs(beforeValue) ? '+' : '';
  return `${sign + Math.round(((afterValue - beforeValue) / beforeValue) * 100)} %`;
};

export default function ApolloSsrPage({ account = null, scale }) {
  return (
    <Layout>
      <h1>Funders Dashboard</h1>

      <p>
        Funder: <a href={`https://opencollective.com/${account.slug}`}>{account.name}</a>
      </p>

      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Collective</th>
            <th>Contributed</th>
            <th>Received past {scale}</th>
            <th>Spent past {scale}</th>
            <th>Current Balance</th>
          </tr>
        </thead>
        <tbody>
          {account?.memberOf?.nodes &&
            uniqBy(account?.memberOf.nodes, node => node.account.slug).map(node => (
              <tr key={node.id}>
                <td>
                  <a href={`https://opencollective.com/${node.account.slug}`}>{node.account.name}</a>
                </td>
                <td style={{ textAlign: 'center' }}>
                  {node.totalDonations.value} {node.totalDonations.currency}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {node.account.stats.totalAmountReceivedPastMonth.value}{' '}
                  {node.account.stats.totalAmountReceivedPastMonth.currency}
                  <br />
                  <small>
                    (previous: {node.account.stats.totalAmountReceivedPreviousMonth.value}{' '}
                    {node.account.stats.totalAmountReceivedPreviousMonth.currency}){' '}
                    {makeDiff(
                      node.account.stats.totalAmountReceivedPastMonth.value,
                      node.account.stats.totalAmountReceivedPreviousMonth.value,
                    )}
                  </small>
                </td>
                <td style={{ textAlign: 'center' }}>
                  {node.account.stats.totalAmountSpentPastMonth.value}{' '}
                  {node.account.stats.totalAmountSpentPastMonth.currency}
                  <br />
                  <small>
                    (previous: {node.account.stats.totalAmountSpentPreviousMonth.value}{' '}
                    {node.account.stats.totalAmountSpentPreviousMonth.currency}){' '}
                    {makeDiff(
                      node.account.stats.totalAmountSpentPastMonth.value,
                      node.account.stats.totalAmountSpentPreviousMonth.value,
                    )}
                  </small>
                </td>
                <td style={{ textAlign: 'center' }}>
                  {node.account.stats.balance.value} {node.account.stats.balance.currency}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {!account?.memberOf?.nodes && <p>No data.</p>}
    </Layout>
  );
}