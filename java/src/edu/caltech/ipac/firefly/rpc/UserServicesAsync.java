package edu.caltech.ipac.firefly.rpc;

import com.google.gwt.user.client.rpc.AsyncCallback;
import edu.caltech.ipac.firefly.fuse.data.DataSetInfo;
import edu.caltech.ipac.firefly.fuse.data.config.DatasetTag;

import java.util.List;
import java.util.Map;

/**
 * @author tatianag
 * @version $Id: UserServicesAsync.java,v 1.11 2011/04/30 00:01:45 loi Exp $
 */
public interface UserServicesAsync {


    // TAG and search history related methods

    void updatePreference(String prefname, String prefvalue, AsyncCallback async);

    void updatePreferences(Map<String, String> prefmap, AsyncCallback async);

    void getUserInfo(boolean includePreferences, AsyncCallback async);

    void addTag(String queryString, String desc, AsyncCallback async);

    void getTag(String tagName, AsyncCallback async);

    void removeTag(String tagName, AsyncCallback async);

    void getTags(AsyncCallback async);   // return all tags created by current user

    void addSearchHistory(String queryString, String desc, boolean isFavorite, AsyncCallback async);

    void getSearch(int searchId, AsyncCallback async);

    void removeSearch(int[] searchIds, AsyncCallback async);

    void updateSearchHistory(int searchId, boolean isFavorite, String desc, AsyncCallback async);

    void getSearchHistory(AsyncCallback async);   // all search history for current user.

    void getAlerts(AsyncCallback async);

    void getDatasetConfig(String dsName, AsyncCallback async);

    void getAllDatasetInfo(AsyncCallback async);

}
