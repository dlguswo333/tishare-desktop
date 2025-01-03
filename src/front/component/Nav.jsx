import {useEffect, useState} from 'react';
import JobView from './JobView';
import MenuIcon from '../icons/Menu.svg?react';
import SettingsIcon from '../icons/Settings.svg?react';
import {MAX_NUM_JOBS} from '../../defs';
import '../style/Nav.scss';

const ipcRenderer = window.ipcRenderer;

/**
 * @param {object} props
 * @param {Function} props.toggleSettings
 * @param {object} props.items
 */
function Nav ({toggleSettings, items}) {
  const [grow, setGrow] = useState(false);
  const [noti, setNoti] = useState(false);
  const [numJobs, setNumJobs] = useState(0);
  const [jobs, setJobs] = useState({});

  useEffect(() => {
    if (grow)
      setNoti(false);
  }, [grow]);

  useEffect(() => {
    ipcRenderer.onJobState((_, job) => {
      setJobs((jobs) => {
        let tmp = {};
        Object.assign(tmp, jobs);
        tmp[job['ind']] = job;
        return tmp;
      });
    });
    return () => { ipcRenderer.removeJobStateCallback(); };
  }, []);

  useEffect(() => {
    ipcRenderer.onDeleteJobState((_, ind) => {
      setJobs((jobs) => {
        let tmp = {};
        Object.assign(tmp, jobs);
        delete tmp[ind];
        return tmp;
      });
    });
    return () => { ipcRenderer.removeDeleteJobStateCallback(); };
  }, []);

  useEffect(() => {
    ipcRenderer.onNumJobs((_, numJobs) => {
      setNumJobs(numJobs);
    });
    return () => { ipcRenderer.removeNumJobsCallback(); };
  }, []);

  return (
    <nav className={grow ? 'Nav Grow' : 'Nav'}>
      <div className='Head'>
        <div className='Element'>
          <div className='Settings' onClick={toggleSettings}>
            <SettingsIcon />
          </div>
        </div>
        <div className='Element'>
          <div className={numJobs === MAX_NUM_JOBS ? 'NumJobs Full' : 'NumJobs'}>{`${numJobs}/${MAX_NUM_JOBS}`}</div>
        </div>
        <div className='Element'>
          <div className='Menu'>
            <button className='Icon MenuButton' onClick={() => setGrow(!grow)}>
              <MenuIcon />
            </button>
            {noti && <div className='Circle' />}
          </div>
        </div>
      </div>
      <div className='Body'>

        {/* <JobView state={{ state: STATE.RQE_RECV_REQUEST, speed: 483344, progress: 50, id: 'july', itemName: 'files_that_has_too_long_file_name_and_this_is_going_to_be_trimmed.jpg', totalProgress: '1/2' }} />
        <JobView state={{ state: STATE.RQR_RECV_REQUEST, speed: 110203, progress: 100, id: 'mason', itemName: 'files_that_has_too_long_file_name.jpg' }} />
        <JobView state={{ state: STATE.SENDING, speed: 11033403, progress: 60, id: 'july', itemName: 'report about theme ui.docx', totalProgress: '1/2' }} /> */}

        {Object.entries(jobs).map(([ind, job]) => (
          <JobView state={job} ind={ind} items={items} key={ind} />
        ))}
      </div>
    </nav>
  );
}

export default Nav;
