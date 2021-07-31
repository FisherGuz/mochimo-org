
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useGetLedgerBalancesBySearchQuery,
  useGetLedgerEntryByTypeAddressQuery,
  useGetTransactionsBySearchQuery
} from './service/mochimap-api';
import {
  Card,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  IconButton,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp';
import ErrorIcon from '@material-ui/icons/Error';
import MochimoAddress from './component/MochimoAddress';
import MCMSuffix from './component/MCMSuffix';
import TimePrep from './component/TimePrep';
import QRCode from 'qrcode.react';
import clsx from 'clsx';

const useStyles = makeStyles((theme) => ({
  columnFlex: {
    display: 'flex',
    'flex-direction': 'column',
    position: 'relative',
    alignItems: 'center'
  },
  outerSpacing: {
    margin: theme.spacing(1)
  },
  innerSpacing: {
    padding: theme.spacing(2)
  },
  table: {
    display: 'block',
    margin: '0 auto',
    background: theme.palette.action.hover,
    'max-width': '95vw',
    '& td, & th': {
      'padding-top': theme.spacing(0.25),
      'padding-bottom': theme.spacing(0.25),
      'padding-left': theme.spacing(1),
      'padding-right': theme.spacing(1)
    }
  },
  tagwots: {
    'max-width': '80vw'
  },
  detailsTable: {
    margin: '0 auto',
    background: theme.palette.action.hover
  },
  txidCell: {
    'max-width': '80vw'
  },
  addressCell: {
    [theme.breakpoints.down('lg')]: {
      'max-width': '55vw'
    },
    [theme.breakpoints.down('md')]: {
      'max-width': '45vw'
    },
    [theme.breakpoints.down('sm')]: {
      'max-width': '20vw'
    },
    [theme.breakpoints.down('xs')]: {
      'max-width': '22vw'
    }
  },
  detailsAddressCell: {
    [theme.breakpoints.down('md')]: {
      'max-width': '70vw'
    },
    [theme.breakpoints.down('sm')]: {
      'max-width': '55vw'
    },
    [theme.breakpoints.down('xs')]: {
      'max-width': '40vw'
    }
  },
  xsDownHide: {
    [theme.breakpoints.down('xs')]: {
      display: 'none'
    }
  },
  smOnlyHide: {
    [theme.breakpoints.only('sm')]: {
      display: 'none'
    }
  }
}));

const Blank = '----';
const DEFAULT_TAG = '420000000e00000001000000';
const isUntagged = (addr) => ['00', '42'].includes(addr.slice(0, 2));
const splitTransaction = (tx, address) => {
  const stxs = [];
  // deconstruct transaction elements
  const { srcaddr, srctag, dstaddr, dsttag, chgaddr, chgtag } = tx;
  // deconstruct transaction
  const sT = tx.sendtotal;
  const cT = tx.changetotal;
  const src = isUntagged(srctag) ? srcaddr : srctag;
  // const dst = isUntagged(dsttag) ? dstaddr : dsttag;
  const chg = isUntagged(chgtag) ? chgaddr : chgtag;
  // derive reference address position
  if ((srctag + srcaddr).includes(address)) address = 'src';
  if ((dsttag + dstaddr).includes(address)) address = 'dst';
  if ((chgtag + chgaddr).includes(address)) address = 'chg';
  // build simple transactions' base object
  const add = { _id: tx._id, time: tx.stime, block: tx.bnum };
  // determine simple transactions by conditional transaction element comparison
  if (address === 'src' && src === chg) { // 1 of 2 simple transactions take place
    if (sT || !cT) { // dst @ -(sT), else chg @ -(cT)
      stxs.push({ ...add, tag: dsttag, address: dstaddr, amount: -(sT) });
    } else stxs.push({ ...add, tag: chgtag, address: chgaddr, amount: -(cT) });
  } else { // 1 OR 2 simple transactions take place
    if ((sT && address !== 'chg') || address === 'dst') {
      if (address === src) { // dst @ -(sT), else src @ sT
        stxs.push({ ...add, tag: dsttag, address: dstaddr, amount: -(sT) });
      } else stxs.push({ ...add, tag: srctag, address: srcaddr, amount: sT });
    } // and/or
    if ((cT && address !== 'dst') || address === 'chg') {
      if (address === src) { // chg @ -(cT), else src @ cT
        stxs.push({ ...add, tag: chgtag, address: chgaddr, amount: -(cT) });
      } else stxs.push({ ...add, tag: srctag, address: srcaddr, amount: cT });
    }
  }
  // return simple transactions
  return stxs;
};

function TableRowCells ({ key, cells }) {
  return (
    <TableRow>
      {(Array.isArray(cells) ? cells : [cells]).map((cell, index) => (
        <TableCell key={`${key}-cell${index}`} {...cell} />
      ))}
    </TableRow>
  );
}

function TransactionRow ({ key, tx, address }) {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(!open);
  const classes = useStyles();

  const _cid = `${key}-details`;
  const _label = _cid.replace('-', ' ');

  const stxs = splitTransaction(tx, address);
  const txDetailsPreHeadCells = {
    variant: 'head',
    colSpan: 4,
    className: classes.txidCell,
    children: (
      <Typography align='left' variant='body2' noWrap>
        TxID: <Link to={`/explorer/transaction/${tx.txid}`}>{tx.txid}</Link>
        <br />
        <MochimoAddress pre='Source: ' tag={tx.srctag} addr={tx.srcaddr} />
      </Typography>
    )
  };
  const txDetailsHeadCells = [{}, {
    variant: 'head',
    className: classes.detailsAddressCell,
    children: 'Destinations'
  }, {
    variant: 'head', children: 'Fee', align: 'right'
  }, {
    variant: 'head', children: 'Amount', align: 'right'
  }];
  const txDetailsCells = [
    ...(tx.dstarray ? tx.dstarray.map((dst) => [{},
      { // mdtx destination entries
        className: classes.detailsAddressCell,
        children: (
          <Typography variant='body2' noWrap>
            <MochimoAddress tag={dst.tag} />
          </Typography>
        )
      }, {
        children: (<MCMSuffix value={dst.fee} disableUnits />), align: 'right'
      }, {
        children: (<MCMSuffix value={dst.amount} />), align: 'right'
      }
    ]) : [[{},
      { // non-mdtx transaction destination entry
        className: classes.detailsAddressCell,
        children: (
          <Typography variant='body2' noWrap>
            <MochimoAddress tag={tx.dsttag} addr={tx.dstaddr} />
          </Typography>
        )
      }, {
        children: (<MCMSuffix value={tx.txfee} disableUnits />), align: 'right'
      }, {
        children: (<MCMSuffix value={tx.sendtotal} />), align: 'right'
      }
    ]]), [{},
      { // change entry
        className: classes.detailsAddressCell,
        children: (
          <Typography variant='body2' noWrap>
            <MochimoAddress pre='Change: ' tag={tx.chgtag} addr={tx.chgaddr} />
          </Typography>
        )
      }, {
        children: null, align: 'right'
      }, {
        children: (<MCMSuffix value={tx.changetotal} />), align: 'right'
      }
    ]
  ];

  return (
    <>
      {stxs.map((stx, index) => {
        const isLast = Boolean(index + 1 === stxs.length);
        const stxCells = [
          {
            children: !isLast ? null : (
              <IconButton size='small' onClick={handleOpen}>
                {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
              </IconButton>
            )
          }, {
            className: classes.addressCell,
            children: (
              <Typography noWrap>
                <MochimoAddress tag={stx.tag} addr={stx.address} />
              </Typography>
            )
          }, {
            children: (
              <Typography noWrap>
                <TimePrep epoch={stx.time} />
              </Typography>
            )
          }, {
            className: classes.xsDownHide,
            children: (
              <Typography noWrap>
                {stx.block}
              </Typography>
            )
          }, {
            className: classes.xsDownHide,
            children: (
              <Typography noWrap>
                {stx.amount < 0 ? 'OUT' : 'IN'}
              </Typography>
            ),
            align: 'right'
          }, {
            children: (
              <Typography noWrap>
                <MCMSuffix value={stx.amount} />
              </Typography>
            ),
            align: 'right'
          }
        ];
        return (<TableRowCells key={`${key}-stx-${index}`} cells={stxCells} />);
      })}
      <TableRow>
        <TableCell style={{ padding: 0 }} colSpan={6}>
          <Collapse in={open} timeout='auto' unmountOnExit>
            <Table size='small' className={classes.detailsTable} aria-label={_label}>
              <TableRowCells key={`${_cid}`} cells={txDetailsPreHeadCells} />
              <TableRowCells key={`${_cid}-head`} cells={txDetailsHeadCells} />
              {txDetailsCells.map((cells, index) => (
                <TableRowCells key={`${_cid}-details-${index}`} cells={cells} />
              ))}
            </Table>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function NeogenesisRow ({ key, data }) {
  const classes = useStyles();

  const cells = [
    {
      children: (
        <Typography noWrap><MCMSuffix value={data.balance} /></Typography>
      )
    }, {
      children: (
        <Typography noWrap>
          <TimePrep epoch={data.timestamp} />
        </Typography>
      )
    }, {
      className: classes.xsDownHide,
      children: (
        <Typography noWrap>{data.bnum}</Typography>
      )
    }, {
      className: classes.xsDownHide,
      children: (
        <Typography noWrap>{`Æ${data.bnum >> 8}`}</Typography>
      )
    }, {
      children: (
        <Typography noWrap><MCMSuffix value={data.delta} /></Typography>
      ),
      align: 'right'
    }
  ];

  return (<TableRowCells key={`${key}-balance`} cells={cells} />);
}

function TransactionHistory ({ ledger, type, address }) {
  const searchAddress = ledger.data?.[type].slice(0, 64) || address;
  const searchObject = { [type]: searchAddress };
  const search = new URLSearchParams(searchObject).toString() + '&perpage=32';
  const history = useGetTransactionsBySearchQuery({ search });
  const classes = useStyles();

  const _cid = 'transation-history-table';
  const _label = _cid.replace('-', ' ');

  const tableHeadCells = [
    { variant: 'head' },
    { variant: 'head', children: 'Reference' },
    { variant: 'head', children: 'Time' },
    { variant: 'head', className: classes.xsDownHide, children: 'Block' },
    { variant: 'head', className: classes.xsDownHide },
    { variant: 'head', children: 'Amount', align: 'right' }
  ];
  const loadingCells = {
    align: 'center', colSpan: 6, children: (<CircularProgress size='4rem' />)
  };

  return (
    <TableContainer component={Container} className={classes.innerSpacing}>
      <Table size='small' className={classes.table} aria-label={_label}>
        <TableRowCells key={`${_cid}-head`} cells={tableHeadCells} />
        {history.isLoading ? (<TableRowCells cells={loadingCells} />) : (
          history.data.results?.map((tx, ii) => (
            <TransactionRow key={`${_cid}-${ii}`} address={address} tx={tx} />
          ))
        )}
      </Table>
    </TableContainer>
  );
}

function NeogenesisHistory ({ ledger, type, address }) {
  const searchObject = { [type]: ledger.data?.[type].slice(0, 64) || address };
  const search = new URLSearchParams(searchObject).toString() + '&perpage=32';
  const history = useGetLedgerBalancesBySearchQuery({ search });
  const classes = useStyles();

  const _cid = 'balance-history-table';
  const _label = _cid.replace('-', ' ');

  const tableHeadCells = [
    { variant: 'head', children: 'NG-Balance' },
    { variant: 'head', children: 'Time' },
    { variant: 'head', className: classes.xsDownHide, children: 'Block' },
    { variant: 'head', className: classes.xsDownHide, children: 'Aeon' },
    { variant: 'head', children: 'NG-Delta', align: 'right' }
  ];
  const loadingCells = {
    align: 'center', colSpan: 5, children: (<CircularProgress size='4rem' />)
  };

  return (
    <TableContainer component={Container} className={classes.innerSpacing}>
      <Table size='small' className={classes.table} aria-label={_label}>
        <TableRowCells key={`${_cid}-head`} cells={tableHeadCells} />
        {history.isLoading ? (<TableRowCells cells={loadingCells} />) : (
          history.data.results?.map((data, ii) => (
            <NeogenesisRow key={`${_cid}-${ii}`} data={data} />
          ))
        )}
      </Table>
    </TableContainer>
  );
}

function TabPanel (props) {
  const { name, active, ledger, showError, check, reason, children } = props;

  return active ? (
    <>
      {check || ledger.isFetching || (showError && ledger.isError) ? (
        <>
          <Typography variant='h6'>Cannot Display {name}</Typography>
          <Typography variant='caption'>
            Reason: {check ? reason : ledger.isFetching ? (
              'waiting for validated ledger data...'
            ) : 'an error occurred (╥﹏╥)'}
          </Typography>
        </>
      ) : children}
    </>
  ) : null;
}

export default function ExplorerLedgerTypeAddress () {
  const { type, address } = useParams();
  const ledger = useGetLedgerEntryByTypeAddressQuery({ type, address });
  const [wots, setWots] = useState(type === 'address' && address);
  const [tag, setTag] = useState(type === 'tag' && address);
  const [tab, setTab] = useState(1);
  const classes = useStyles();

  const { columnFlex, innerSpacing, outerSpacing, tagwots } = classes;
  const handleTab = (e, selectedTab) => { setTab(selectedTab); };

  useEffect(() => {
    if (ledger.data) {
      setWots(ledger.data.address);
      setTag(ledger.data.tag);
    }
  }, [type, address, ledger.data]);

  return (
    <Container className={clsx(columnFlex, innerSpacing)}>
      <Typography noWrap className={clsx(tagwots, outerSpacing)}>
        <Typography component='span' display='inline' color='textSecondary'>
          τag:&nbsp;
        </Typography>
        <Typography component='span' display='inline' color='textPrimary'>
          {tag || Blank}
        </Typography>
        <span> • </span>
        <Typography component='span' display='inline' color='textSecondary'>
          ωots:&nbsp;
        </Typography>
        <Typography component='span' display='inline' color='textPrimary'>
          {wots || Blank}
        </Typography>
      </Typography>
      <Card className={clsx(columnFlex, innerSpacing, outerSpacing)}>
        <Typography variant='h6'>Balance</Typography>
        {ledger.isFetching ? (
          <CircularProgress size='6rem' color='secondary' />
        ) : (
          <Typography variant='h1'>
            {ledger.isError ? <ErrorIcon /> : (
              <MCMSuffix value={ledger.data.balance} disableUnits />
            )}
          </Typography>
        )}
        <Divider />
        <Typography>
          <Typography
            component='span' variant='subtitle2' display='inline'
            color='textSecondary'
          >
            Available:&nbsp;
          </Typography>
          {ledger.isFetching || ledger.isError ? Blank : (
            <Typography
              component='span' variant='subtitle1' display='inline'
              color='textPrimary'
            >
              <MCMSuffix
                decimals={9}
                disableSuffix
                value={ledger.data.balance}
              />
            </Typography>
          )}
        </Typography>
      </Card>
      <Paper className={clsx(classes.columnFlex, classes.outerSpacing)}>
        <Tabs
          value={tab}
          onChange={handleTab}
          textColor='primary'
          indicatorColor='secondary'
          aria-label='ledger details tabs'
        >
          <Tab label='QR Code' />
          <Tab label='History' />
          <Tab label='Neogenesis History' />
        </Tabs>
        <TabPanel
          showError
          active={tab === 0}
          name='QR Code'
          ledger={ledger}
          check={ledger.data?.tag === DEFAULT_TAG}
          reason={(
            <span>MochiMap only supports a QR code for tagged addresses</span>
          )}
        >
          <QRCode includeMargin value={ledger.data?.tag || ''} />
        </TabPanel>
        <TabPanel name='History' active={tab === 1} ledger={ledger}>
          <TransactionHistory ledger={ledger} type={type} address={address} />
        </TabPanel>
        <TabPanel name='Balance History' active={tab === 2} ledger={ledger}>
          <NeogenesisHistory ledger={ledger} type={type} address={address} />
        </TabPanel>
      </Paper>
    </Container>
  );
}
